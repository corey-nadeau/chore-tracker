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
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  useEffect(() => {
    setupChildListener();
  }, [childToken]);

  useEffect(() => {
    if (child) {
      console.log('Child data loaded, setting up listeners for:', child);
      setupChoresListener();
      setupGoalsListener();
    }
  }, [child]);

  const setupChildListener = () => {
    if (!childToken) return;
    
    console.log('Setting up child listener for token:', childToken);
    
    // Find child by token
    const childrenRef = collection(db, 'children');
    const q = query(childrenRef, where('token', '==', childToken));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log('Child query results for token:', querySnapshot.size, 'documents found');
      
      if (!querySnapshot.empty) {
        const childDoc = querySnapshot.docs[0];
        const childData = { id: childDoc.id, ...childDoc.data() };
        console.log('Child data found:', childData);
        setChild(childData);
      } else {
        console.log('No child found with token:', childToken);
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
    console.log('Setting up goals listener for child ID:', child.id);
    
    // First, let's test if we can access the goals collection at all
    const allGoalsRef = collection(db, 'goals');
    getDocs(allGoalsRef).then(allGoalsSnapshot => {
      console.log('Total goals in database (accessible to child):', allGoalsSnapshot.size);
      allGoalsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Goal ${index + 1}:`, {
          id: doc.id,
          title: data.title,
          childId: data.childId,
          status: data.status,
          parentId: data.parentId,
          childIdMatch: data.childId === child.id
        });
      });
    }).catch(error => {
      console.error('Error accessing goals collection:', error);
    });
    
    const goalsQuery = query(
      collection(db, 'goals'),
      where('childId', '==', child.id),
      where('status', '==', 'active')
    );
    
    const unsubscribe = onSnapshot(goalsQuery, (snapshot) => {
      console.log('Goals query results for child', child.id, ':', snapshot.size, 'documents found');
      
      const goalsData = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        console.log('Goal found:', data);
        return data;
      });
      
      // Sort in JavaScript instead of Firestore to avoid index requirement
      goalsData.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });
      
      setCurrentGoals(goalsData);
      console.log('Final goals state set:', goalsData);
    }, (error) => {
      console.error('Error listening to goals:', error);
      setCurrentGoals([]);
    });

    return unsubscribe;
  };

  const fetchCurrentGoal = async () => {
    // This function is now replaced by setupGoalsListener for real-time updates
    try {
      const goalsQuery = query(
        collection(db, 'goals'),
        where('childId', '==', child.id),
        where('status', '==', 'active')
      );
      
      const goalsSnapshot = await getDocs(goalsQuery);
      if (!goalsSnapshot.empty) {
        const goalsData = goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCurrentGoals(goalsData);
        console.log('Active goals found:', goalsData);
      } else {
        setCurrentGoals([]);
        console.log('No active goals found for child');
      }
    } catch (error) {
      console.error('Error fetching current goals:', error);
    }
  };

  const setupChoresListener = () => {
    console.log('Setting up chores listener for child ID:', child.id);
    
    // First, let's see ALL chores in the database for debugging
    const allChoresRef = collection(db, 'chores');
    getDocs(allChoresRef).then(allChoresSnapshot => {
      console.log('Total chores in database:', allChoresSnapshot.size);
      allChoresSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Chore ${index + 1}:`, {
          id: doc.id,
          title: data.title,
          childId: data.childId,
          status: data.status,
          parentId: data.parentId
        });
      });
    });
    
    // Simplified query without orderBy to avoid index requirement
    const q = query(
      collection(db, 'chores'),
      where('childId', '==', child.id),
      where('status', 'in', ['assigned', 'pending_approval', 'awaiting_goal_selection'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Chores query results for child', child.id, ':', snapshot.size, 'documents found');
      
      const choresData = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        console.log('Chore found:', data);
        return data;
      });
      
      // Sort in JavaScript instead of Firestore
      choresData.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });
      
      console.log('Final sorted chores:', choresData);
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
        // Clear rejection fields when resubmitting
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

  const transferFromSavings = async (goalId, amount) => {
    try {
      const childRef = doc(db, 'children', child.id);
      const currentSavings = child.savingsBucket || 0;
      
      if (currentSavings < amount) {
        toast.error('Not enough money in savings bucket');
        return;
      }

      const goalRef = doc(db, 'goals', goalId);
      const goalDoc = await getDoc(goalRef);
      
      if (goalDoc.exists()) {
        const goalData = goalDoc.data();
        const currentSavedAmount = goalData.savedAmount || 0;
        const newSavedAmount = currentSavedAmount + amount;
        const targetAmount = goalData.targetAmount || 0;
        const goalCompleted = newSavedAmount >= targetAmount;

        // Update goal
        await updateDoc(goalRef, {
          savedAmount: goalCompleted ? targetAmount : newSavedAmount,
          lastUpdated: new Date(),
          ...(goalCompleted && { completedAt: new Date() })
        });

        // Update child's savings bucket
        await updateDoc(childRef, {
          savingsBucket: currentSavings - amount
        });

        // If goal completed, notify parent
        if (goalCompleted) {
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
          toast.success(`$${amount.toFixed(2)} moved to ${goalData.title}! 🎯`);
        }
      }
    } catch (error) {
      console.error('Error transferring from savings:', error);
      toast.error('Failed to transfer money');
    }
  };

  const updateProfilePicture = async (emoji) => {
    try {
      const childRef = doc(db, 'children', child.id);
      await updateDoc(childRef, {
        profilePicture: emoji,
        lastUpdated: new Date()
      });
      
      toast.success(`Profile picture updated! ${emoji}`);
      setShowProfilePicker(false);
    } catch (error) {
      console.error('Error updating profile picture:', error);
      toast.error('Failed to update profile picture');
    }
  };

  const applyRewardToGoal = async (choreId, goalId) => {
    try {
      const chore = chores.find(c => c.id === choreId);
      if (!chore) return;

      let amountToApply = chore.reward;
      let remainderAmount = 0;
      let goalCompleted = false;

      // Update child's total earnings
      const childRef = doc(db, 'children', child.id);
      const childDoc = await getDoc(childRef);
      const currentEarnings = childDoc.data()?.totalEarnings || 0;
      const currentSavings = childDoc.data()?.savingsBucket || 0;
      
      await updateDoc(childRef, {
        totalEarnings: currentEarnings + chore.reward
      });

      // If a specific goal was selected, check if it would exceed the target
      if (goalId) {
        const goalRef = doc(db, 'goals', goalId);
        const goalDoc = await getDoc(goalRef);
        if (goalDoc.exists()) {
          const goalData = goalDoc.data();
          const currentSavedAmount = goalData.savedAmount || 0;
          const targetAmount = goalData.targetAmount || 0;
          const remainingNeeded = Math.max(0, targetAmount - currentSavedAmount);
          
          if (amountToApply >= remainingNeeded && remainingNeeded > 0) {
            // Goal will be completed with this reward
            amountToApply = remainingNeeded;
            remainderAmount = chore.reward - remainingNeeded;
            goalCompleted = true;
            
            await updateDoc(goalRef, {
              savedAmount: targetAmount,
              lastUpdated: new Date(),
              completedAt: new Date()
            });

            // Add remainder to savings bucket
            if (remainderAmount > 0) {
              await updateDoc(childRef, {
                savingsBucket: currentSavings + remainderAmount
              });
            }

            // Notify parent of goal completion
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
            
          } else if (remainingNeeded > 0) {
            // Normal case - add full amount to goal
            await updateDoc(goalRef, {
              savedAmount: currentSavedAmount + amountToApply,
              lastUpdated: new Date()
            });
          } else {
            // Goal already completed, add to savings bucket instead
            await updateDoc(childRef, {
              savingsBucket: currentSavings + chore.reward
            });
            amountToApply = 0;
            remainderAmount = chore.reward;
          }
        }
      } else {
        // Add directly to savings bucket
        await updateDoc(childRef, {
          savingsBucket: currentSavings + chore.reward
        });
      }

      // Mark chore as fully approved and processed
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'approved',
        goalAppliedTo: goalId,
        rewardAppliedAt: new Date()
      });

      // Show appropriate success message
      if (goalCompleted) {
        const goal = currentGoals.find(g => g.id === goalId);
        toast.success(`🎉 GOAL COMPLETED! ${goal?.title} reached! 🎉`, { duration: 6000 });
        if (remainderAmount > 0) {
          toast.success(`$${remainderAmount.toFixed(2)} added to your savings bucket! 💰`, { duration: 4000 });
        }
      } else if (goalId && amountToApply > 0) {
        const goal = currentGoals.find(g => g.id === goalId);
        toast.success(`$${amountToApply.toFixed(2)} added to your ${goal?.title} goal! 🎯💰`);
      } else {
        toast.success(`$${chore.reward.toFixed(2)} added to your savings bucket! 💰`);
      }
    } catch (error) {
      console.error('Error applying reward to goal:', error);
      toast.error('Failed to apply reward');
    }
  };

  const viewGoalDetails = async (goal) => {
    setSelectedGoal(goal);
    
    // Fetch all approved chores for this child
    try {
      const allChoresQuery = query(
        collection(db, 'chores'),
        where('childId', '==', child.id),
        where('status', '==', 'approved')
      );
      
      const choresSnapshot = await getDocs(allChoresQuery);
      const allApprovedChores = choresSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by completion date
      allApprovedChores.sort((a, b) => {
        const aDate = a.rewardAppliedAt?.toDate ? a.rewardAppliedAt.toDate() : new Date(a.approvedAt?.toDate ? a.approvedAt.toDate() : a.createdAt);
        const bDate = b.rewardAppliedAt?.toDate ? b.rewardAppliedAt.toDate() : new Date(b.approvedAt?.toDate ? b.approvedAt.toDate() : b.createdAt);
        return bDate - aDate;
      });
      
      setGoalChores(allApprovedChores);
    } catch (error) {
      console.error('Error fetching goal chores:', error);
      toast.error('Failed to load chore details');
    }
  };

  const reassignChore = async (choreId, newGoalId, oldGoalId) => {
    try {
      const chore = goalChores.find(c => c.id === choreId);
      if (!chore) return;

      const childRef = doc(db, 'children', child.id);
      const currentSavings = child.savingsBucket || 0;

      // Remove reward from old goal if it was assigned to one
      if (oldGoalId) {
        const oldGoalRef = doc(db, 'goals', oldGoalId);
        const oldGoalDoc = await getDoc(oldGoalRef);
        if (oldGoalDoc.exists()) {
          const oldGoalData = oldGoalDoc.data();
          const currentSavedAmount = oldGoalData.savedAmount || 0;
          
          await updateDoc(oldGoalRef, {
            savedAmount: Math.max(0, currentSavedAmount - chore.reward),
            lastUpdated: new Date()
          });
        }
      } else {
        // Remove from savings bucket
        await updateDoc(childRef, {
          savingsBucket: Math.max(0, currentSavings - chore.reward)
        });
      }

      // Add reward to new goal if one is selected
      if (newGoalId) {
        const newGoalRef = doc(db, 'goals', newGoalId);
        const newGoalDoc = await getDoc(newGoalRef);
        if (newGoalDoc.exists()) {
          const newGoalData = newGoalDoc.data();
          const currentSavedAmount = newGoalData.savedAmount || 0;
          const targetAmount = newGoalData.targetAmount || 0;
          const remainingNeeded = Math.max(0, targetAmount - currentSavedAmount);
          
          let amountToApply = chore.reward;
          let remainderAmount = 0;
          let goalCompleted = false;

          if (amountToApply >= remainingNeeded && remainingNeeded > 0) {
            // Goal will be completed
            amountToApply = remainingNeeded;
            remainderAmount = chore.reward - remainingNeeded;
            goalCompleted = true;
            
            await updateDoc(newGoalRef, {
              savedAmount: targetAmount,
              lastUpdated: new Date(),
              completedAt: new Date()
            });

            // Add remainder to savings bucket
            if (remainderAmount > 0) {
              const updatedSavings = Math.max(0, currentSavings - (oldGoalId ? 0 : chore.reward)) + remainderAmount;
              await updateDoc(childRef, {
                savingsBucket: updatedSavings
              });
            }

            // Notify parent of goal completion
            await addDoc(collection(db, 'notifications'), {
              type: 'goal_completed',
              childId: child.id,
              goalId: newGoalId,
              goalTitle: newGoalData.title,
              parentId: child.parentId,
              message: `${child.firstName} has completed their goal: ${newGoalData.title}!`,
              createdAt: new Date(),
              read: false
            });
            
          } else if (remainingNeeded > 0) {
            // Normal case - add full amount to goal
            await updateDoc(newGoalRef, {
              savedAmount: currentSavedAmount + amountToApply,
              lastUpdated: new Date()
            });
          } else {
            // Goal already completed, add to savings bucket instead
            const updatedSavings = Math.max(0, currentSavings - (oldGoalId ? 0 : chore.reward)) + chore.reward;
            await updateDoc(childRef, {
              savingsBucket: updatedSavings
            });
            amountToApply = 0;
            remainderAmount = chore.reward;
          }
        }
      } else {
        // Add to savings bucket
        const updatedSavings = Math.max(0, currentSavings - (oldGoalId ? 0 : chore.reward)) + chore.reward;
        await updateDoc(childRef, {
          savingsBucket: updatedSavings
        });
      }

      // Update chore's goal assignment
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        goalAppliedTo: newGoalId,
        lastReassigned: new Date()
      });

      // Update local state
      setGoalChores(prev => prev.map(c => 
        c.id === choreId ? { ...c, goalAppliedTo: newGoalId } : c
      ));

      const newGoal = currentGoals.find(g => g.id === newGoalId);
      if (newGoalId) {
        toast.success(`$${chore.reward.toFixed(2)} moved to ${newGoal?.title} goal! 🎯`);
      } else {
        toast.success(`$${chore.reward.toFixed(2)} moved to savings bucket! 🪣`);
      }
    } catch (error) {
      console.error('Error reassigning chore:', error);
      toast.error('Failed to reassign chore');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">🏃‍♂️</div>
          <h2 className="text-2xl font-bold text-gray-800">Loading your chores...</h2>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 via-blue-500 to-green-400 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md w-full">
          <div className="text-massive mb-6">🎯</div>
          <h1 className="text-6xl font-fun bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-6 tracking-wide">
            ChoreTracker
          </h1>
          <div className="text-8xl mb-6">😵</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4 font-playful">Child not found</h2>
          <p className="text-xl text-gray-600 font-playful">Please check your link and try again</p>
        </div>
      </div>
    );
  }

  const assignedChores = chores.filter(chore => chore.status === 'assigned');
  const pendingChores = chores.filter(chore => chore.status === 'pending_approval');
  const goalSelectionChores = chores.filter(chore => chore.status === 'awaiting_goal_selection');
  
  // Get progress for each goal
  const getGoalProgress = (goal) => {
    if (!goal.isMonetary) return 0;
    const savedAmount = goal.savedAmount || 0;
    return Math.min(100, (savedAmount / goal.targetAmount) * 100);
  };

  // Profile picture options for kids - exactly 20 emojis
  const profilePictureOptions = [
    // 5 Animals
    '🐶', '🐱', '🐰', '🐼', '🦄',
    // 10 Face emojis  
    '😀', '😃', '😄', '😁', '😆', '😊', '😇', '🙂', '😉', '😎',
    // 5 Sports emojis
    '⚽', '🏀', '🎾', '🏈', '⚾'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-4 pb-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-6 animate-bounce-slow">🎯</div>
          <h1 className="text-super font-fun bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-4 tracking-wide">
            ChoreTracker
          </h1>
          
          {/* Profile Picture */}
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="text-8xl mb-3">
              {child.profilePicture || '😊'}
            </div>
            <button
              onClick={() => setShowProfilePicker(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
            >
              <span>🎨</span>
              <span>Change Picture</span>
            </button>
          </div>
          
          <h2 className="text-4xl font-bold text-gray-800 mb-2 font-playful">
            Hi {child.firstName}! 👋
          </h2>
          <p className="text-2xl text-gray-600 font-playful">Ready to earn some rewards?</p>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8 transform hover:scale-105 transition-transform duration-200">
          <div className="text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Earnings</h2>
            <div className="text-4xl font-bold text-green-600 mb-4">
              ${(child.totalEarnings || 0).toFixed(2)}
            </div>
            
            {/* Savings Bucket */}
            <div className="bg-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <div className="text-3xl">🪣</div>
                <h3 className="text-xl font-bold text-blue-800">Savings Bucket</h3>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-3">
                ${(child.savingsBucket || 0).toFixed(2)}
              </div>
              <p className="text-blue-700 text-sm mb-4">
                Money you can move to your goals
              </p>
              {(child.savingsBucket || 0) > 0 && currentGoals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-blue-600 font-medium">Move money to a goal:</p>
                  {currentGoals.filter(goal => goal.isMonetary && getGoalProgress(goal) < 100).map(goal => {
                    const remainingNeeded = Math.max(0, (goal.targetAmount || 0) - (goal.savedAmount || 0));
                    const canTransfer = Math.min(child.savingsBucket || 0, remainingNeeded);
                    
                    if (canTransfer > 0) {
                      return (
                        <button
                          key={goal.id}
                          onClick={() => transferFromSavings(goal.id, canTransfer)}
                          className="block w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                          Add ${canTransfer.toFixed(2)} to {goal.title}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
            
            {/* Current Goals Display */}
            {currentGoals.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-purple-800 mb-4">🎯 Your Goals</h3>
                {currentGoals.map((goal, index) => {
                  const progressPercentage = getGoalProgress(goal);
                  const isCompleted = goal.isMonetary && progressPercentage >= 100;
                  
                  return (
                    <div 
                      key={goal.id} 
                      className="bg-purple-50 rounded-xl p-6 border-2 border-purple-200 cursor-pointer hover:border-purple-300 hover:shadow-lg transition-all duration-200"
                      onClick={() => viewGoalDetails(goal)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xl font-bold text-purple-800">{goal.title}</h4>
                        <div className="flex items-center space-x-2">
                          {isCompleted && (
                            <div className="text-2xl animate-bounce">🎉</div>
                          )}
                          <div className="text-purple-400">👆 Click to view</div>
                        </div>
                      </div>
                      
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
                                You've reached your goal! Ask your parent to mark this as finished and claim your reward!
                              </p>
                              <div className="mt-3 text-green-500 text-sm">
                                ✨ Amazing work! You did it! ✨
                              </div>
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
                          <p className="text-yellow-700 text-sm mt-1">
                            Your parent will decide when you've earned it!
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
            <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-6 mb-6">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎉</div>
                <h3 className="text-xl font-bold text-purple-800">Great job! Your chores were approved!</h3>
                <p className="text-purple-600">Choose which goal you want to save this money toward:</p>
              </div>
            </div>
            
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
                        {currentGoals.filter(goal => goal.isMonetary && getGoalProgress(goal) < 100).map(goal => {
                          const remainingNeeded = Math.max(0, (goal.targetAmount || 0) - (goal.savedAmount || 0));
                          const canApplyFull = chore.reward <= remainingNeeded;
                          
                          return (
                            <button
                              key={goal.id}
                              onClick={() => applyRewardToGoal(chore.id, goal.id)}
                              className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-xl transition-colors font-bold"
                            >
                              🎯 {goal.title}
                              <span className="block text-sm opacity-75">
                                ${(goal.savedAmount || 0).toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                              </span>
                              {!canApplyFull && (
                                <span className="block text-xs opacity-75 mt-1">
                                  Only ${remainingNeeded.toFixed(2)} needed - remainder goes to savings
                                </span>
                              )}
                            </button>
                          );
                        })}
                        
                        {/* Savings Bucket Option */}
                        <button
                          onClick={() => applyRewardToGoal(chore.id, null)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-xl transition-colors font-bold"
                        >
                          🪣 Add to Savings Bucket
                          <span className="block text-sm opacity-75">
                            Save for later or apply to goals
                          </span>
                        </button>
                      </div>
                      
                      {/* Show completed goals */}
                      {currentGoals.filter(goal => goal.isMonetary && getGoalProgress(goal) >= 100).length > 0 && (
                        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-green-700 text-sm font-medium mb-2">✅ Completed Goals:</p>
                          {currentGoals.filter(goal => goal.isMonetary && getGoalProgress(goal) >= 100).map(goal => (
                            <p key={goal.id} className="text-green-600 text-sm">
                              🎉 {goal.title} - Goal reached!
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">You don't have any goals set yet!</p>
                      <button
                        onClick={() => applyRewardToGoal(chore.id, null)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold"
                      >
                        🪣 Add to Savings Bucket
                      </button>
                      <p className="text-gray-500 text-sm mt-2">
                        Money goes to your savings bucket until you have goals
                      </p>
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
            🧹 Your Chores
          </h2>
          
          {assignedChores.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">All done!</h3>
              <p className="text-gray-600">No chores assigned right now. Great job! 🌟</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assignedChores.map(chore => (
                <div key={chore.id} className="bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
                  {/* Rejection Message */}
                  {chore.rejectedAt && (
                    <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-3 mb-4 text-center">
                      <div className="text-2xl mb-2">🔄</div>
                      <p className="text-orange-800 font-bold">
                        {chore.rejectionMessage || "It looks like you need to try this again!"}
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        Parent feedback: {new Date(chore.rejectedAt.toDate()).toLocaleDateString()}
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
                      {chore.type && <span>🏠 {chore.type}</span>}
                    </div>

                    {chore.instructions && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>How to do it:</strong> {chore.instructions}
                        </p>
                      </div>
                    )}

                    {chore.dueDate && (
                      <p className="text-sm text-orange-600 mb-4">
                        📅 Due: {new Date(chore.dueDate.toDate()).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => markChoreComplete(chore.id)}
                    className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold py-6 px-8 rounded-2xl hover:from-yellow-500 hover:to-orange-500 transform hover:scale-105 hover:animate-wiggle transition-all duration-200 shadow-lg text-2xl font-playful animate-pulse-slow border-4 border-yellow-300 relative overflow-hidden"
                  >
                    <span className="relative z-10">✅ Done!</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-yellow-400 opacity-0 hover:opacity-20 transition-opacity duration-200"></div>
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

      {/* Goal Details Modal */}
      {selectedGoal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedGoal(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8 min-h-fit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 md:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedGoal(null)}
                    className="text-purple-600 hover:text-purple-800 text-3xl mr-2 p-2 hover:bg-purple-100 rounded-full transition-colors"
                    title="Go back"
                  >
                    ←
                  </button>
                  <div className="text-3xl">🎯</div>
                  <div>
                    <h2 className="text-2xl font-bold text-purple-800">{selectedGoal.title}</h2>
                    {selectedGoal.description && (
                      <p className="text-purple-600">{selectedGoal.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGoal(null)}
                  className="text-gray-400 hover:text-gray-600 text-3xl p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Goal Progress */}
              {selectedGoal.isMonetary && (
                <div className="bg-purple-50 rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-purple-700 font-semibold">Progress:</span>
                    <span className="text-green-600 font-bold text-lg">
                      ${(selectedGoal.savedAmount || 0).toFixed(2)} / ${selectedGoal.targetAmount.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="w-full bg-purple-200 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${getGoalProgress(selectedGoal)}%` }}
                    ></div>
                  </div>
                  
                  <div className="mt-3 text-center">
                    <span className="text-purple-600 font-medium">
                      ${((selectedGoal.targetAmount || 0) - (selectedGoal.savedAmount || 0)).toFixed(2)} left to reach your goal!
                    </span>
                  </div>
                </div>
              )}

              {/* Chores List */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Your Completed Chores</h3>
                
                {goalChores.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-gray-600">No completed chores yet. Keep working on your chores!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {goalChores.map(chore => {
                      const isAssignedToThisGoal = chore.goalAppliedTo === selectedGoal.id;
                      const assignedGoal = currentGoals.find(g => g.id === chore.goalAppliedTo);
                      
                      return (
                        <div 
                          key={chore.id} 
                          className={`p-4 rounded-xl border-2 ${
                            isAssignedToThisGoal 
                              ? 'bg-purple-50 border-purple-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <div className="text-2xl">{getChoreIcon(chore.category)}</div>
                                <div>
                                  <h4 className="font-bold text-gray-800">{chore.title}</h4>
                                  <p className="text-sm text-gray-600">{chore.description}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span>💰 ${chore.reward.toFixed(2)}</span>
                                <span>📅 {new Date(chore.rewardAppliedAt?.toDate() || chore.approvedAt?.toDate() || chore.createdAt).toLocaleDateString()}</span>
                                <span>
                                  🎯 {isAssignedToThisGoal 
                                    ? 'This goal' 
                                    : (assignedGoal ? assignedGoal.title : 'Savings bucket')
                                  }
                                </span>
                              </div>
                            </div>
                            
                            {/* Reassignment Options */}
                            <div className="ml-4">
                              <select
                                value={chore.goalAppliedTo || ''}
                                onChange={(e) => reassignChore(chore.id, e.target.value || null, chore.goalAppliedTo)}
                                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Savings Bucket 🪣</option>
                                {currentGoals.filter(g => g.status === 'active' && g.isMonetary).map(goal => {
                                  const isCompleted = getGoalProgress(goal) >= 100;
                                  return (
                                    <option key={goal.id} value={goal.id} disabled={isCompleted}>
                                      {goal.title} {isCompleted ? '(Completed ✅)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Back Button */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center bg-white sticky bottom-0">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedGoal(null);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors shadow-lg"
                >
                  ← Back to Goals
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Picture Picker Modal */}
      {showProfilePicker && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProfilePicker(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex-shrink-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">⚙️</div>
                  <h2 className="text-2xl font-bold text-blue-800">Profile Settings</h2>
                </div>
                <button
                  onClick={() => setShowProfilePicker(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Current Profile Picture */}
              <div className="text-center mb-6 p-4 bg-gray-50 rounded-xl">
                <div className="text-6xl mb-3">{child.profilePicture || '😊'}</div>
                <p className="text-gray-600 font-medium">Current Profile Picture</p>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Choose a New Picture:</h3>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6">
              {/* Profile Picture Grid */}
              <div className="grid grid-cols-5 gap-4 pb-6 justify-items-center">
                {profilePictureOptions.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => updateProfilePicture(emoji)}
                    className={`text-5xl w-16 h-16 flex items-center justify-center rounded-2xl border-2 transition-all duration-200 hover:scale-110 hover:shadow-lg ${
                      child.profilePicture === emoji 
                        ? 'border-blue-500 bg-blue-100 shadow-lg' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 flex-shrink-0 border-t border-gray-200">
              <div className="text-center">
                <p className="text-gray-600 text-sm">
                  Choose from animals, faces, or fun characters! 🎉
                </p>
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
