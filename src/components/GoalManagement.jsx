import { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import notificationService from '../services/notificationService';

function GoalManagement({ parentId, children, chores }) {
  const [goals, setGoals] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [expandedGoal, setExpandedGoal] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('dashboard'); // 'dashboard', 'children', 'chores'
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferChild, setTransferChild] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferGoal, setTransferGoal] = useState(null);
  const [formData, setFormData] = useState({
    childId: '',
    title: '',
    description: '',
    targetAmount: '',
    isMonetary: true
  });
  const [loading, setLoading] = useState(false);

  // Listen to goals changes
  useEffect(() => {
    const q = query(
      collection(db, 'goals'),
      where('parentId', '==', parentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const goalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in JavaScript instead of Firestore to avoid index requirement
      goalsData.sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bDate - aDate;
      });
      
      setGoals(goalsData);
    }, (error) => {
      console.error('Error listening to goals:', error);
      setGoals([]);
    });

    return () => unsubscribe();
  }, [parentId]);

  // Check if completed goals should be reverted due to insufficient earnings
  useEffect(() => {
    const checkAndRevertCompletedGoals = async () => {
      const completedGoalsToRevert = goals.filter(goal => {
        if (goal.status !== 'completed' || !goal.isMonetary) return false;
        
        const child = children.find(c => c.id === goal.childId);
        if (!child) return false;
        
        // If child's current earnings are less than the goal target, revert it
        return (child.totalEarnings || 0) < goal.targetAmount;
      });

      // Revert goals that no longer meet the earnings requirement
      for (const goal of completedGoalsToRevert) {
        try {
          await updateDoc(doc(db, 'goals', goal.id), {
            status: 'active',
            completedAt: null,
            completedBy: null
          });
          console.log(`Reverted goal "${goal.title}" due to insufficient earnings`);
        } catch (error) {
          console.error('Error reverting goal:', error);
        }
      }
    };

    if (goals.length > 0 && children.length > 0) {
      checkAndRevertCompletedGoals();
    }
  }, [goals, children]);

  const getChildName = (childId) => {
    const child = children.find(c => c.id === childId);
    return child ? child.firstName : 'Unknown';
  };

  const getChild = (childId) => {
    return children.find(c => c.id === childId);
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const goalData = {
        childId: formData.childId,
        title: formData.title,
        description: formData.description,
        targetAmount: formData.isMonetary ? parseFloat(formData.targetAmount) : null,
        isMonetary: formData.isMonetary,
        status: 'active',
        startingEarnings: 0,
        savedAmount: 0,
        autoApply: false, // Initialize as false, child can toggle this later
        parentId: parentId,
        createdAt: new Date(),
        createdBy: parentId
      };

      // Get child's current earnings as starting point
      const child = getChild(formData.childId);
      if (child) {
        goalData.startingEarnings = child.totalEarnings || 0;
      }

      console.log('Creating goal with data:', goalData);
      const docRef = await addDoc(collection(db, 'goals'), goalData);
      console.log('Goal created with ID:', docRef.id);

      // Send notification about new goal
      try {
        const child = children.find(c => c.id === formData.childId);
        if (child) {
          await notificationService.notifyGoalAdded(
            child.firstName, 
            formData.title, 
            formData.targetAmount
          );
        }
      } catch (error) {
        console.error('Error sending goal notification:', error);
      }

      // Don't manually update state - let the Firebase listener handle it
      // This prevents duplicates and ensures consistency

      toast.success('Goal created successfully! 🎯');
      setShowAddGoal(false);
      setFormData({
        childId: '',
        title: '',
        description: '',
        targetAmount: '',
        isMonetary: true
      });
    } catch (error) {
      console.error('Error creating goal:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        formData: formData,
        parentId: parentId
      });
      toast.error(`Failed to create goal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const completeGoal = async (goalId) => {
    try {
      const goalRef = doc(db, 'goals', goalId);
      await updateDoc(goalRef, {
        status: 'completed',
        completedAt: new Date(),
        completedBy: parentId
      });

      // Reset child's earnings to 0 for next goal
      const goal = goals.find(g => g.id === goalId);
      if (goal) {
        const childRef = doc(db, 'children', goal.childId);
        await updateDoc(childRef, {
          totalEarnings: 0
        });

        // Send notification about goal completion
        try {
          const child = children.find(c => c.id === goal.childId);
          if (child) {
            await notificationService.notifyGoalReached(
              child.firstName, 
              goal.title, 
              `$${goal.targetAmount}`
            );
          }
        } catch (error) {
          console.error('Error sending goal completion notification:', error);
        }
      }

      toast.success('Goal completed and archived! 🎉 Earnings reset for next goal.');
    } catch (error) {
      console.error('Error completing goal:', error);
      toast.error('Failed to complete goal');
    }
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setFormData({
      childId: goal.childId,
      title: goal.title,
      description: goal.description,
      targetAmount: goal.targetAmount?.toString() || '',
      isMonetary: goal.isMonetary
    });
    setShowEditGoal(true);
  };

  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const goalRef = doc(db, 'goals', editingGoal.id);
      const updateData = {
        title: formData.title,
        description: formData.description,
        targetAmount: formData.isMonetary ? parseFloat(formData.targetAmount) : null,
        isMonetary: formData.isMonetary,
        updatedAt: new Date(),
        updatedBy: parentId
      };

      await updateDoc(goalRef, updateData);

      // Don't manually update state - let the Firebase listener handle it
      // This ensures consistency and prevents conflicts

      toast.success('Goal updated successfully! ✏️');
      setShowEditGoal(false);
      setEditingGoal(null);
      setFormData({
        childId: '',
        title: '',
        description: '',
        targetAmount: '',
        isMonetary: true
      });
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Failed to update goal');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId, goalTitle) => {
    if (!confirm(`Are you sure you want to delete the goal "${goalTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'goals', goalId));

      // Don't manually update state - let the Firebase listener handle it
      // This ensures consistency and prevents conflicts

      toast.success('Goal deleted successfully! 🗑️');
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Failed to delete goal');
    }
  };

  const resetForm = () => {
    setFormData({
      childId: '',
      title: '',
      description: '',
      targetAmount: '',
      isMonetary: true
    });
    setShowAddGoal(false);
    setShowEditGoal(false);
    setEditingGoal(null);
  };

  const getGoalProgress = (goal) => {
    if (!goal.isMonetary) return 0;
    
    const savedAmount = goal.savedAmount || 0;
    const progress = (savedAmount / goal.targetAmount) * 100;
    return Math.min(100, progress);
  };

  const getGoalChores = (goalId) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return [];

    // Get chores for this child from when the goal was created
    return chores.filter(chore => 
      chore.childId === goal.childId && 
      chore.status === 'approved' &&
      chore.approvedAt &&
      chore.approvedAt.toDate() >= goal.createdAt.toDate()
    );
  };

  const transferFromSavingsToGoal = async () => {
    if (!transferChild || !transferGoal || !transferAmount || transferAmount <= 0) {
      toast.error('Please fill in all fields with valid values');
      return;
    }

    const amount = parseFloat(transferAmount);
    const currentSavings = transferChild.savingsBucket || 0;

    if (amount > currentSavings) {
      toast.error('Not enough money in savings bucket');
      return;
    }

    try {
      const childRef = doc(db, 'children', transferChild.id);
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

      toast.success(`$${amount.toFixed(2)} transferred from ${transferChild.firstName}'s savings to ${transferGoal.title}! 💰`);
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferGoal(null);
      setTransferChild(null);
    } catch (error) {
      console.error('Error transferring from savings:', error);
      toast.error('Failed to transfer funds');
    }
  };

  const activeGoals = goals.filter(goal => goal.status === 'active');
  const completedGoals = goals.filter(goal => goal.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">🎯 Goal Management</h2>
        <button
          onClick={() => setShowAddGoal(true)}
          disabled={children.length === 0}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
        >
          ➕ Create Goal
        </button>
      </div>

      {children.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please add children first before creating goals.</p>
        </div>
      )}

      {/* Children Savings Dashboard */}
      {children.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">👨‍👩‍👧‍👦 Children's Savings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map(child => {
              const childGoals = activeGoals.filter(g => g.childId === child.id);
              const monetaryGoals = childGoals.filter(g => g.isMonetary);
              const savingsAmount = child.savingsBucket || 0;
              
              return (
                <div key={child.id} className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <h4 className="font-bold text-gray-900 mb-2">{child.firstName}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>💰 Total Earnings:</span>
                      <span className="font-bold text-green-600">
                        ${(child.totalEarnings || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>💳 Savings Bucket:</span>
                      <span className="font-bold text-blue-600">
                        ${savingsAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>🎯 Active Goals:</span>
                      <span className="font-bold text-purple-600">
                        {monetaryGoals.length}
                      </span>
                    </div>
                  </div>
                  
                  {savingsAmount > 0 && monetaryGoals.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          // Set up transfer modal for this child
                          setTransferChild(child);
                          setShowTransferModal(true);
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                      >
                        💰 Transfer to Goals
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Goal Form */}
      {showAddGoal && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🎯 Create New Goal</h3>
          <form onSubmit={handleCreateGoal} className="space-y-4">
            <fieldset disabled={loading} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Child *
                </label>
                <select
                  value={formData.childId}
                  onChange={(e) => setFormData({ ...formData, childId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a child</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.firstName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Goal Type *
                </label>
                <select
                  value={formData.isMonetary}
                  onChange={(e) => setFormData({ ...formData, isMonetary: e.target.value === 'true' })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="true">💰 Monetary Goal</option>
                  <option value="false">🎁 Reward Goal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Goal Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., 'Save for new bike' or 'Earn movie night'"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
                placeholder="What is this goal for?"
              />
            </div>

            {formData.isMonetary && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="25.00"
                  required
                />
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Goal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      )}

      {/* Edit Goal Form */}
      {showEditGoal && editingGoal && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">✏️ Edit Goal</h3>
          <form onSubmit={handleUpdateGoal} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Child
                </label>
                <select
                  value={formData.childId}
                  disabled
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                >
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.firstName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Child cannot be changed after goal creation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Goal Type
                </label>
                <select
                  value={formData.isMonetary}
                  disabled
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                >
                  <option value="true">💰 Monetary Goal</option>
                  <option value="false">🎁 Reward Goal</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Goal type cannot be changed after creation</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Goal Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Save for a new bike"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
                placeholder="What is this goal for?"
              />
            </div>

            {formData.isMonetary && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="25.00"
                  required
                />
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Goal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">🏃‍♂️ Active Goals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeGoals.map(goal => {
              const child = getChild(goal.childId);
              const progress = getGoalProgress(goal);
              const isCompleted = goal.isMonetary && progress >= 100;

              return (
                <div key={goal.id} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-400">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{goal.title}</h4>
                      <p className="text-purple-600 font-medium">{getChildName(goal.childId)}</p>
                      {goal.description && (
                        <p className="text-gray-600 text-sm mt-1">{goal.description}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditGoal(goal)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                        title="Edit Goal"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id, goal.title)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                        title="Delete Goal"
                      >
                        🗑️ Delete
                      </button>
                      {isCompleted && (
                        <button
                          onClick={() => completeGoal(goal.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                        >
                          🎉 Complete
                        </button>
                      )}
                    </div>
                  </div>

                  {goal.isMonetary ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>${(goal.savedAmount || 0).toFixed(2)} saved</span>
                        <span>${goal.targetAmount.toFixed(2)} goal</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500">{progress.toFixed(1)}% complete</p>
                    </div>
                  ) : (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-purple-800 text-sm">
                        🎁 Reward-based goal - Complete when ready!
                      </p>
                      <button
                        onClick={() => completeGoal(goal.id)}
                        className="mt-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Mark as Earned
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">🏆 Completed Goals</h3>
          <div className="space-y-4">
            {completedGoals.map(goal => {
              const goalChores = getGoalChores(goal.id);
              const isExpanded = expandedGoal === goal.id;
              
              return (
                <div key={goal.id} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-400">
                  <div 
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                  >
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg flex items-center">
                        🏆 {goal.title}
                        <span className="text-sm text-gray-500 ml-2">({getChildName(goal.childId)})</span>
                      </h4>
                      <p className="text-gray-600 text-sm">
                        Completed: {new Date(goal.completedAt?.toDate()).toLocaleDateString()}
                      </p>
                      {goal.isMonetary && (
                        <p className="text-green-600 font-medium">
                          Target: ${goal.targetAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600 font-bold">{goalChores.length} chores</span>
                      <span className="text-gray-400">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="font-medium text-gray-900 mb-3">Chores completed for this goal:</h5>
                      {goalChores.length === 0 ? (
                        <p className="text-gray-500 text-sm">No chores completed for this goal.</p>
                      ) : (
                        <div className="space-y-2">
                          {goalChores.map(chore => (
                            <div key={chore.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                              <div>
                                <span className="font-medium">{chore.title}</span>
                                <span className="text-sm text-gray-500 ml-2">
                                  {new Date(chore.approvedAt?.toDate()).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="text-green-600 font-bold">
                                +${chore.reward.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="flex justify-between items-center font-bold">
                              <span>Total Earned:</span>
                              <span className="text-green-600">
                                +${goalChores.reduce((sum, chore) => sum + chore.reward, 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">No goals yet</h3>
          <p className="text-gray-600">Create your first goal to start tracking progress!</p>
        </div>
      )}

      {/* Transfer from Savings Modal */}
      {showTransferModal && transferChild && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              💰 Transfer from {transferChild.firstName}'s Savings
            </h3>
            <p className="text-gray-600 mb-4 text-center">
              Available in savings: ${(transferChild.savingsBucket || 0).toFixed(2)}
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
                    const goal = activeGoals.find(g => g.id === e.target.value && g.childId === transferChild.id);
                    setTransferGoal(goal);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a goal</option>
                  {activeGoals.filter(goal => goal.isMonetary && goal.childId === transferChild.id).map(goal => {
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
                  max={transferChild.savingsBucket || 0}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {transferGoal && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-sm text-purple-800">
                    <strong>{transferGoal.title}</strong><br/>
                    Current: ${(transferGoal.savedAmount || 0).toFixed(2)} / ${transferGoal.targetAmount.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={transferFromSavingsToGoal}
                  disabled={!transferGoal || !transferAmount || transferAmount <= 0}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💰 Transfer
                </button>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferAmount('');
                    setTransferGoal(null);
                    setTransferChild(null);
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
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

export default GoalManagement;
