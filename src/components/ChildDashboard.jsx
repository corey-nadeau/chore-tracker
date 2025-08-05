import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';
import SuccessModal from './SuccessModal';

function ChildDashboard() {
  const { childToken } = useParams();
  const [child, setChild] = useState(null);
  const [chores, setChores] = useState([]);
  const [currentGoals, setCurrentGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedChore, setCompletedChore] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [goalChores, setGoalChores] = useState([]);

  useEffect(() => {
    setupChildListener();
  }, [childToken]);

  useEffect(() => {
    if (child) {
      setupChoresListener();
      setupGoalsListener();
    }
  }, [child]);

  const setupChildListener = () => {
    if (!childToken) return;
    
    const childrenRef = collection(db, 'children');
    const q = query(childrenRef, where('token', '==', childToken));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const childDoc = querySnapshot.docs[0];
        const childData = { id: childDoc.id, ...childDoc.data() };
        setChild(childData);
      } else {
        setChild(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error in child listener:', error);
      setChild(null);
      setLoading(false);
    });

    return () => unsubscribe();
  };

  const setupGoalsListener = () => {
    const goalsQuery = query(
      collection(db, 'goals'),
      where('childId', '==', child.id),
      where('status', '==', 'active')
    );
    
    const unsubscribe = onSnapshot(goalsQuery, (snapshot) => {
      const goalsData = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        return data;
      });
      
      goalsData.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });
      
      setCurrentGoals(goalsData);
    }, (error) => {
      console.error('Error listening to goals:', error);
      setCurrentGoals([]);
    });

    return unsubscribe;
  };

  const setupChoresListener = () => {
    const q = query(
      collection(db, 'chores'),
      where('childId', '==', child.id),
      where('status', 'in', ['assigned', 'pending_approval', 'awaiting_goal_selection'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const choresData = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        return data;
      });
      
      choresData.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });
      
      setChores(choresData);
    }, (error) => {
      console.error('Error in chores listener:', error);
      toast.error(`Failed to load chores: ${error.message}`);
    });

    return () => unsubscribe();
  };

  const markChoreComplete = async (choreId) => {
    try {
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'pending_approval',
        completedAt: new Date(),
        completedBy: child.id,
        rejectedAt: null,
        rejectedBy: null,
        rejectionMessage: null
      });

      const chore = chores.find(c => c.id === choreId);
      setCompletedChore(chore);
      setShowSuccessModal(true);

      toast.success('Great job! Waiting for parent approval 🎉');
    } catch (error) {
      toast.error('Failed to mark chore as complete');
    }
  };

  const applyRewardToGoal = async (choreId, goalId) => {
    try {
      const chore = chores.find(c => c.id === choreId);
      if (!chore) return;

      const childRef = doc(db, 'children', child.id);
      const childDoc = await getDoc(childRef);
      const currentEarnings = childDoc.data()?.totalEarnings || 0;
      const currentSavings = childDoc.data()?.savingsBucket || 0;
      
      await updateDoc(childRef, {
        totalEarnings: currentEarnings + chore.reward
      });

      if (goalId) {
        const goalRef = doc(db, 'goals', goalId);
        const goalDoc = await getDoc(goalRef);
        if (goalDoc.exists()) {
          const goalData = goalDoc.data();
          const currentSavedAmount = goalData.savedAmount || 0;
          const targetAmount = goalData.targetAmount || 0;
          const remainingNeeded = Math.max(0, targetAmount - currentSavedAmount);
          
          if (chore.reward >= remainingNeeded && remainingNeeded > 0) {
            await updateDoc(goalRef, {
              savedAmount: targetAmount,
              lastUpdated: new Date(),
              completedAt: new Date()
            });

            const remainder = chore.reward - remainingNeeded;
            if (remainder > 0) {
              await updateDoc(childRef, {
                savingsBucket: currentSavings + remainder
              });
            }

            await addDoc(collection(db, 'notifications'), {
              type: 'goal_completed',
              childId: child.id,
              goalId: goalId,
              goalTitle: goalData.title,
              parentId: child.parentId,
              message: `${child.firstName} has completed their goal: ${goalData.title}!`,
              createdAt: new Date(),
              read: false
            });
            
            toast.success(`🎉 GOAL COMPLETED! ${goalData.title} reached! 🎉`, { duration: 6000 });
          } else {
            await updateDoc(goalRef, {
              savedAmount: currentSavedAmount + chore.reward,
              lastUpdated: new Date()
            });
            toast.success(`$${chore.reward.toFixed(2)} added to ${goalData.title}! 🎯`);
          }
        }
      } else {
        await updateDoc(childRef, {
          savingsBucket: currentSavings + chore.reward
        });
        toast.success(`$${chore.reward.toFixed(2)} added to your savings bucket! 💰`);
      }

      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'approved',
        goalAppliedTo: goalId,
        rewardAppliedAt: new Date()
      });
    } catch (error) {
      console.error('Error applying reward to goal:', error);
      toast.error('Failed to apply reward');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-green-100">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">⏳</div>
          <h2 className="text-2xl font-bold text-gray-800">Loading your chores...</h2>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 via-blue-500 to-green-400 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md w-full">
          <div className="text-8xl mb-6">🎯</div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-6">
            ChoreTracker
          </h1>
          <div className="text-8xl mb-6">😕</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Child not found</h2>
          <p className="text-xl text-gray-600">Please check your link and try again</p>
        </div>
      </div>
    );
  }

  const assignedChores = chores.filter(chore => chore.status === 'assigned');
  const pendingChores = chores.filter(chore => chore.status === 'pending_approval');
  const goalSelectionChores = chores.filter(chore => chore.status === 'awaiting_goal_selection');
  
  const getGoalProgress = (goal) => {
    if (!goal.isMonetary) return 0;
    const savedAmount = goal.savedAmount || 0;
    return Math.min(100, (savedAmount / goal.targetAmount) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-green-100 p-4 pb-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-8xl mb-6 animate-bounce">🎯</div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-4">
            ChoreTracker
          </h1>
          
          <div className="text-8xl mb-3">
            {child.profilePicture || '😊'}
          </div>
          
          <h2 className="text-4xl font-bold text-gray-800 mb-2">
            Hi {child.firstName}! 👋
          </h2>
          <p className="text-2xl text-gray-600">Ready to earn some rewards?</p>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
          <div className="text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Earnings</h2>
            <div className="text-4xl font-bold text-green-600 mb-4">
              ${(child.totalEarnings || 0).toFixed(2)}
            </div>
            
            {/* Savings Bucket */}
            <div className="bg-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <div className="text-3xl">💳</div>
                <h3 className="text-xl font-bold text-blue-800">Savings Bucket</h3>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-3">
                ${(child.savingsBucket || 0).toFixed(2)}
              </div>
              <p className="text-blue-700 text-sm">
                Money you can move to your goals
              </p>
            </div>
            
            {/* Current Goals Display */}
            {currentGoals.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-purple-800 mb-4">🎯 Your Goals</h3>
                {currentGoals.map((goal) => {
                  const progressPercentage = getGoalProgress(goal);
                  const isCompleted = goal.isMonetary && progressPercentage >= 100;
                  
                  return (
                    <div key={goal.id} className="bg-purple-50 rounded-xl p-6 border-2 border-purple-200">
                      <h4 className="text-xl font-bold text-purple-800 mb-3">{goal.title}</h4>
                      
                      {goal.description && (
                        <p className="text-purple-600 mb-3">{goal.description}</p>
                      )}
                      
                      {goal.isMonetary ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-purple-700 font-semibold">Progress:</span>
                            <span className="text-green-600 font-bold">
                              ${(goal.savedAmount || 0).toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="w-full bg-purple-200 rounded-full h-6">
                            <div 
                              className="bg-gradient-to-r from-green-400 to-blue-500 h-6 rounded-full transition-all duration-500 flex items-center justify-center"
                              style={{ width: `${progressPercentage}%` }}
                            >
                              {progressPercentage > 15 && (
                                <span className="text-white text-sm font-bold">
                                  {Math.round(progressPercentage)}%
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isCompleted ? (
                            <div className="bg-green-100 rounded-lg p-4 text-center border-2 border-green-300">
                              <div className="text-4xl mb-2 animate-bounce">🎉</div>
                              <p className="text-green-800 font-bold text-xl mb-2">
                                🎉 CONGRATULATIONS! 🎉
                              </p>
                              <p className="text-green-700 font-bold text-lg mb-2">
                                Goal Completed!
                              </p>
                              <p className="text-green-600">
                                You've reached your goal! Ask your parent to mark this as finished!
                              </p>
                            </div>
                          ) : (
                            <p className="text-purple-600 text-center">
                              💪 ${((goal.targetAmount || 0) - (goal.savedAmount || 0)).toFixed(2)} left to reach your goal!
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-yellow-100 rounded-lg p-4 text-center">
                          <div className="text-3xl mb-2">🎁</div>
                          <p className="text-yellow-800 font-bold">
                            Keep doing chores to earn this reward!
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">😊</div>
                <p className="text-gray-600 font-semibold text-lg">No goals set yet</p>
                <p className="text-gray-500">Ask your parent to create a goal for you!</p>
              </div>
            )}
          </div>
        </div>

        {/* Goal Selection for Approved Chores */}
        {goalSelectionChores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              🎯 Choose Your Goal!
            </h2>
            <div className="space-y-6">
              {goalSelectionChores.map(chore => (
                <div key={chore.id} className="bg-white rounded-3xl shadow-lg p-6">
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-2">💰</div>
                    <h3 className="text-lg font-bold text-gray-800">{chore.title}</h3>
                    <p className="text-green-600 font-bold text-xl">${chore.reward.toFixed(2)} earned!</p>
                  </div>
                  
                  {currentGoals.length > 0 ? (
                    <div>
                      <p className="text-center text-gray-600 mb-4">Which goal do you want to save this toward?</p>
                      <div className="grid grid-cols-1 gap-3">
                        {currentGoals.filter(goal => goal.isMonetary && getGoalProgress(goal) < 100).map(goal => (
                          <button
                            key={goal.id}
                            onClick={() => applyRewardToGoal(chore.id, goal.id)}
                            className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-xl transition-colors font-bold"
                          >
                            🎯 {goal.title}
                            <span className="block text-sm opacity-75">
                              ${(goal.savedAmount || 0).toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                            </span>
                          </button>
                        ))}
                        
                        <button
                          onClick={() => applyRewardToGoal(chore.id, null)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-xl transition-colors font-bold"
                        >
                          💳 Add to Savings Bucket
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={() => applyRewardToGoal(chore.id, null)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold"
                      >
                        💳 Add to Savings Bucket
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Chores */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            🏆 Your Chores
          </h2>
          
          {assignedChores.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">All done!</h3>
              <p className="text-gray-600">No chores assigned right now. Great job! 🎊</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assignedChores.map(chore => (
                <div key={chore.id} className="bg-white rounded-3xl shadow-lg p-6">
                  {chore.rejectedAt && (
                    <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-3 mb-4 text-center">
                      <div className="text-2xl mb-2">⚠️</div>
                      <p className="text-orange-800 font-bold">
                        {chore.rejectionMessage || "It looks like you need to try this again!"}
                      </p>
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">{getChoreIcon(chore.category)}</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{chore.title}</h3>
                    <p className="text-gray-600 mb-2">{chore.description}</p>
                    
                    <div className="flex justify-center items-center space-x-4 text-sm text-gray-500 mb-4">
                      <span>📍 {chore.location}</span>
                      <span>💰 ${chore.reward.toFixed(2)}</span>
                    </div>

                    {chore.instructions && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>How to do it:</strong> {chore.instructions}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => markChoreComplete(chore.id)}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold py-6 px-8 rounded-2xl hover:from-yellow-500 hover:to-orange-500 transform hover:scale-105 transition-all duration-200 shadow-lg text-2xl"
                  >
                    ✅ Done!
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approval */}
        {pendingChores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              ⏳ Waiting for Approval
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingChores.map(chore => (
                <div key={chore.id} className="bg-yellow-50 border-2 border-yellow-200 rounded-3xl shadow-lg p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">⏳</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{chore.title}</h3>
                    <p className="text-gray-600 mb-2">Waiting for parent to approve</p>
                    <div className="text-lg font-bold text-yellow-600">
                      💰 ${chore.reward.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && completedChore && (
        <SuccessModal
          chore={completedChore}
          child={child}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </div>
  );
}

function getChoreIcon(category) {
  const icons = {
    cleaning: '🧽',
    dishes: '🍽️',
    laundry: '👕',
    outdoor: '🌱',
    pets: '🐕',
    organization: '📦',
    homework: '📚',
    other: '⭐'
  };
  return icons[category] || '⭐';
}

export default ChildDashboard;
