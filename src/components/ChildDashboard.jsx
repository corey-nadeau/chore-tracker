import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';
import SuccessModal from './SuccessModal';
import notificationService from '../services/notificationService';

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
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferGoal, setTransferGoal] = useState(null);

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
    console.log('=== CHILD DASHBOARD DEBUG ===');
    console.log('childToken from URL params:', childToken);
    console.log('typeof childToken:', typeof childToken);
    console.log('childToken length:', childToken?.length);
    
    if (!childToken) {
      console.log('❌ No childToken provided');
      setLoading(false);
      return;
    }
    
    // Convert to uppercase to match stored tokens
    const searchToken = childToken.toUpperCase();
    console.log('✅ Looking for child with token (original):', childToken);
    console.log('✅ Looking for child with token (uppercase):', searchToken);
    
    const childrenRef = collection(db, 'children');
    const q = query(childrenRef, where('token', '==', searchToken));
    console.log('📝 Query created, setting up listener...');
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log('📡 Query snapshot received!');
      console.log('Query snapshot size:', querySnapshot.size);
      console.log('Query snapshot empty:', querySnapshot.empty);
      
      if (!querySnapshot.empty) {
        const childDoc = querySnapshot.docs[0];
        const childData = { id: childDoc.id, ...childDoc.data() };
        console.log('✅ Found child:', childData);
        console.log('Child firstName:', childData.firstName);
        console.log('Child token:', childData.token);
        setChild(childData);
      } else {
        console.log('❌ No child found with token:', searchToken);
        console.log('Checked collection: children');
        console.log('Checked field: token');
        console.log('Checked value:', searchToken);
        setChild(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('🚨 Error in child listener:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
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
      
      // Send notification to parents about completed chore
      try {
        await notificationService.notifyChoreCompleted(child.firstName, chore.title);
      } catch (error) {
        console.error('Error sending chore completion notification:', error);
      }
      
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

      // Note: totalEarnings is now updated when parent approves chore, not here

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

  const transferFromSavings = async () => {
    if (!transferGoal || !transferAmount || transferAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(transferAmount);
    const currentSavings = child.savingsBucket || 0;

    if (amount > currentSavings) {
      toast.error('Not enough money in savings bucket');
      return;
    }

    try {
      const childRef = doc(db, 'children', child.id);
      const goalRef = doc(db, 'goals', transferGoal.id);

      // Update child's savings bucket
      await updateDoc(childRef, {
        savingsBucket: Math.max(0, currentSavings - amount)
      });

      // Update goal's saved amount
      const currentSaved = transferGoal.savedAmount || 0;
      await updateDoc(goalRef, {
        savedAmount: currentSaved + amount
      });

      toast.success(`$${amount.toFixed(2)} transferred to ${transferGoal.title}! 💰`);
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferGoal(null);
    } catch (error) {
      console.error('Error transferring from savings:', error);
      toast.error('Failed to transfer funds');
    }
  };

  const toggleAutoApply = async (goalId, currentAutoApply) => {
    try {
      // If we're enabling auto-apply, first disable it for all other goals for this child
      if (!currentAutoApply) {
        const otherGoalsQuery = query(
          collection(db, 'goals'),
          where('childId', '==', child.id),
          where('status', '==', 'active'),
          where('autoApply', '==', true)
        );
        
        const otherGoalsSnapshot = await getDocs(otherGoalsQuery);
        
        // Disable auto-apply for other goals
        for (const goalDoc of otherGoalsSnapshot.docs) {
          if (goalDoc.id !== goalId) {
            await updateDoc(doc(db, 'goals', goalDoc.id), {
              autoApply: false
            });
          }
        }
      }

      // Toggle auto-apply for the selected goal
      const goalRef = doc(db, 'goals', goalId);
      await updateDoc(goalRef, {
        autoApply: !currentAutoApply
      });

      if (!currentAutoApply) {
        toast.success('Auto-apply enabled! 🎯 New approved chore money will automatically go to this goal.');
      } else {
        toast.success('Auto-apply disabled! You can now choose where to put your money.');
      }
    } catch (error) {
      console.error('Error toggling auto-apply:', error);
      toast.error('Failed to update auto-apply setting');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-green-100 p-2 sm:p-4 pb-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 w-full">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 px-2">
          <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-4">
            ChoreTracker
          </h1>
          
          <div className="text-6xl sm:text-8xl mb-3">
            {child.profilePicture || '😊'}
          </div>
          
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-2">
            Hi {child.firstName}! 👋
          </h2>
          <p className="text-lg sm:text-2xl text-gray-600">Ready to earn some rewards?</p>
        </div>

        {/* Available Chores */}
        <div className="mb-6 sm:mb-8 px-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
            🏆 Your Chores
          </h2>
          
          {assignedChores.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8 text-center">
              <div className="text-4xl sm:text-6xl mb-4">🎉</div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">All done!</h3>
              <p className="text-gray-600">No chores assigned right now. Great job! 🎊</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {assignedChores.map(chore => (
                <div key={chore.id} className="bg-white rounded-3xl shadow-lg p-4 sm:p-6 w-full">
                  {chore.rejectedAt && (
                    <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-3 mb-4 text-center">
                      <div className="text-xl sm:text-2xl mb-2">⚠️</div>
                      <p className="text-orange-800 font-bold text-sm sm:text-base">
                        {chore.rejectionMessage || "It looks like you need to try this again!"}
                      </p>
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <div className="text-3xl sm:text-4xl mb-2">{getChoreIcon(chore.category)}</div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 break-words">{chore.title}</h3>
                    <p className="text-gray-600 mb-2 text-sm sm:text-base break-words">{chore.description}</p>
                    
                    <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-4">
                      {chore.location && <span className="break-words">📍 {chore.location}</span>}
                      <span>💰 ${chore.reward.toFixed(2)}</span>
                    </div>

                    {chore.instructions && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-4">
                        <p className="text-xs sm:text-sm text-blue-800 break-words">
                          <strong>How to do it:</strong> {chore.instructions}
                        </p>
                      </div>
                    )}

                    {chore.dueDate && (
                      <p className="text-xs sm:text-sm text-orange-600 mb-4 break-words">
                        📅 Due: {new Date(chore.dueDate.toDate()).toLocaleDateString()}
                        {(() => {
                          const dueDateTime = new Date(chore.dueDate.toDate());
                          const hours = dueDateTime.getHours();
                          const minutes = dueDateTime.getMinutes();
                          
                          // Don't show time for common "default" times that were likely unintended
                          const isDefaultTime = (hours === 0 && minutes === 0) ||  // midnight
                                              (hours === 19 && minutes === 0) ||  // 7 PM (common default)
                                              (hours === 12 && minutes === 0);    // noon (another common default)
                          
                          return !isDefaultTime ? 
                            ` at ${dueDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : '';
                        })()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => markChoreComplete(chore.id)}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold py-3 px-4 sm:px-6 rounded-xl hover:from-yellow-500 hover:to-orange-500 transform hover:scale-105 transition-all duration-200 shadow-lg text-base sm:text-lg"
                  >
                    ✅ Done!
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-8 mb-6 sm:mb-8 mx-2 sm:mx-0">
          <div className="text-center">
            <div className="text-4xl sm:text-6xl mb-4">💰</div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Your Earnings</h2>
            <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-4">
              ${(child.totalEarnings || 0).toFixed(2)}
            </div>
            
            {/* Savings Bucket */}
            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-blue-200">
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-3">
                <div className="text-2xl sm:text-3xl">💳</div>
                <h3 className="text-lg sm:text-xl font-bold text-blue-800">Savings Bucket</h3>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-3">
                ${(child.savingsBucket || 0).toFixed(2)}
              </div>
              <p className="text-blue-700 text-sm mb-4">
                Money you can move to your goals
              </p>
              
              {/* Transfer Button - only show if there are savings and goals */}
              {(child.savingsBucket || 0) > 0 && currentGoals.some(g => g.isMonetary) && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  💰 Transfer to Goal
                </button>
              )}
            </div>
            
            {/* Current Goals Display */}
            {currentGoals.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-xl sm:text-2xl font-bold text-purple-800 mb-4">🎯 Your Goals</h3>
                {currentGoals.map((goal) => {
                  const progressPercentage = getGoalProgress(goal);
                  const isCompleted = goal.isMonetary && progressPercentage >= 100;
                  
                  return (
                    <div key={goal.id} className={`bg-purple-50 rounded-xl p-4 sm:p-6 border-2 ${goal.autoApply ? 'border-purple-400 bg-purple-100' : 'border-purple-200'}`}>
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h4 className="text-lg sm:text-xl font-bold text-purple-800 break-words flex-1 min-w-0">{goal.title}</h4>
                        {goal.autoApply && (
                          <div className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-bold flex-shrink-0">
                            ⚡ AUTO
                          </div>
                        )}
                      </div>
                      
                      {goal.description && (
                        <p className="text-purple-600 mb-3 text-sm sm:text-base break-words">{goal.description}</p>
                      )}
                      
                      {goal.isMonetary ? (
                        <div className="space-y-3">
                          {/* Auto-Apply Toggle - only for monetary goals */}
                          <div className="bg-white rounded-lg p-3 border-2 border-purple-300">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <span className="text-sm font-medium text-purple-800 break-words">
                                  🎯 Auto-Apply New Money
                                </span>
                                <div className="group relative flex-shrink-0">
                                  <div className="text-purple-600 cursor-help">ℹ️</div>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    When enabled, new approved chore money automatically goes to this goal instead of the waiting bin.
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => toggleAutoApply(goal.id, goal.autoApply)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex-shrink-0 ${
                                  goal.autoApply ? 'bg-purple-600' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    goal.autoApply ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {goal.autoApply && (
                              <p className="text-xs text-purple-600 mt-2 font-medium break-words">
                                ✅ New approved chore money will automatically go here!
                              </p>
                            )}
                          </div>
                          
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <span className="text-purple-700 font-semibold text-sm sm:text-base">Progress:</span>
                            <span className="text-green-600 font-bold text-sm sm:text-base">
                              ${(goal.savedAmount || 0).toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="w-full bg-purple-200 rounded-full h-6">
                            <div 
                              className="bg-gradient-to-r from-green-400 to-blue-500 h-6 rounded-full transition-all duration-500 flex items-center justify-center"
                              style={{ width: `${progressPercentage}%` }}
                            >
                              {progressPercentage > 15 && (
                                <span className="text-white text-xs sm:text-sm font-bold">
                                  {Math.round(progressPercentage)}%
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isCompleted ? (
                            <div className="bg-green-100 rounded-lg p-4 text-center border-2 border-green-300">
                              <div className="text-3xl sm:text-4xl mb-2 animate-bounce">🎉</div>
                              <p className="text-green-800 font-bold text-lg sm:text-xl mb-2">
                                🎉 CONGRATULATIONS! 🎉
                              </p>
                              <p className="text-green-700 font-bold text-base sm:text-lg mb-2">
                                Goal Completed!
                              </p>
                              <p className="text-green-600 text-sm sm:text-base break-words">
                                You've reached your goal! Ask your parent to mark this as finished!
                              </p>
                            </div>
                          ) : (
                            <p className="text-purple-600 text-center text-sm sm:text-base break-words">
                              💪 ${((goal.targetAmount || 0) - (goal.savedAmount || 0)).toFixed(2)} left to reach your goal!
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-yellow-100 rounded-lg p-4 text-center">
                          <div className="text-2xl sm:text-3xl mb-2">🎁</div>
                          <p className="text-yellow-800 font-bold text-sm sm:text-base break-words">
                            Keep doing chores to earn this reward!
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 sm:p-6 text-center">
                <div className="text-3xl sm:text-4xl mb-3">😊</div>
                <p className="text-gray-600 font-semibold text-base sm:text-lg">No goals set yet</p>
                <p className="text-gray-500 text-sm sm:text-base">Ask your parent to create a goal for you!</p>
              </div>
            )}
          </div>
        </div>

        {/* Goal Selection for Approved Chores */}
        {goalSelectionChores.length > 0 && (
          <div className="mb-6 sm:mb-8 px-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
              🎯 Choose Your Goal!
            </h2>
            
            {/* Show auto-apply status */}
            {currentGoals.some(goal => goal.autoApply) && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 sm:mb-6 text-center">
                <div className="text-2xl sm:text-3xl mb-2">ℹ️</div>
                <p className="text-blue-800 font-medium text-sm sm:text-base break-words">
                  <strong>Note:</strong> You have auto-apply enabled for one of your goals. 
                  New approved chores will automatically go there unless you turn it off first.
                </p>
              </div>
            )}
            
            <div className="space-y-4 sm:space-y-6">
              {goalSelectionChores.map(chore => (
                <div key={chore.id} className="bg-white rounded-3xl shadow-lg p-4 sm:p-6">
                  <div className="text-center mb-4">
                    <div className="text-2xl sm:text-3xl mb-2">💰</div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">{chore.title}</h3>
                    <p className="text-green-600 font-bold text-lg sm:text-xl">${chore.reward.toFixed(2)} earned!</p>
                  </div>
                  
                  {currentGoals.length > 0 ? (
                    <div>
                      <p className="text-center text-gray-600 mb-4 text-sm sm:text-base">Which goal do you want to save this toward?</p>
                      <div className="grid grid-cols-1 gap-3">
                        {currentGoals.filter(goal => goal.isMonetary && getGoalProgress(goal) < 100).map(goal => (
                          <button
                            key={goal.id}
                            onClick={() => applyRewardToGoal(chore.id, goal.id)}
                            className="bg-purple-500 hover:bg-purple-600 text-white p-3 sm:p-4 rounded-xl transition-colors font-bold text-sm sm:text-base break-words text-left"
                          >
                            🎯 {goal.title}
                            {goal.autoApply && <span className="text-xs block opacity-75">⚡ Auto-Apply Goal</span>}
                            <span className="block text-xs sm:text-sm opacity-75">
                              ${(goal.savedAmount || 0).toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                            </span>
                          </button>
                        ))}
                        
                        <button
                          onClick={() => applyRewardToGoal(chore.id, null)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-3 sm:p-4 rounded-xl transition-colors font-bold text-sm sm:text-base"
                        >
                          💳 Add to Savings Bucket
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={() => applyRewardToGoal(chore.id, null)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-3 rounded-xl font-bold text-sm sm:text-base"
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

        {/* Pending Approval */}
        {pendingChores.length > 0 && (
          <div className="mb-6 sm:mb-8 px-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
              ⏳ Waiting for Approval
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {pendingChores.map(chore => (
                <div key={chore.id} className="bg-yellow-50 border-2 border-yellow-200 rounded-3xl shadow-lg p-4 sm:p-6 w-full">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl mb-2">⏳</div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 break-words">{chore.title}</h3>
                    <p className="text-gray-600 mb-2 text-sm sm:text-base">Waiting for parent to approve</p>
                    <div className="text-base sm:text-lg font-bold text-yellow-600">
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

      {/* Transfer from Savings Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full mx-2">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 text-center">
              💰 Transfer from Savings
            </h3>
            <p className="text-gray-600 mb-4 text-center text-sm sm:text-base">
              Available in savings: ${(child.savingsBucket || 0).toFixed(2)}
            </p>
            
            <div className="space-y-4">
              {/* Goal Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Goal
                </label>
                <select
                  value={transferGoal?.id || ''}
                  onChange={(e) => {
                    const goal = currentGoals.find(g => g.id === e.target.value);
                    setTransferGoal(goal);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  required
                >
                  <option value="">Select a goal</option>
                  {currentGoals.filter(goal => goal.isMonetary).map(goal => {
                    const remaining = (goal.targetAmount || 0) - (goal.savedAmount || 0);
                    return (
                      <option key={goal.id} value={goal.id}>
                        {goal.title} (${remaining.toFixed(2)} needed)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Transfer
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={child.savingsBucket || 0}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="0.00"
                />
              </div>

              {transferGoal && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-800 break-words">
                    <strong>{transferGoal.title}</strong><br/>
                    Current: ${(transferGoal.savedAmount || 0).toFixed(2)} / ${transferGoal.targetAmount.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={transferFromSavings}
                  disabled={!transferGoal || !transferAmount || transferAmount <= 0}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  💰 Transfer
                </button>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferAmount('');
                    setTransferGoal(null);
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
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
