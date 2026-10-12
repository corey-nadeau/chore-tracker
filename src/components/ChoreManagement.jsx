import { useState, useEffect } from 'react';
import { collection, addDoc, doc, deleteDoc, updateDoc, getDoc, arrayRemove, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import notificationService from '../services/notificationService';

const getNextDueDate = (dueDate, recurrence, recurrenceDay) => {
  const nextDueDate = dueDate?.toDate ? dueDate.toDate() : dueDate ? new Date(dueDate) : new Date();

  if (recurrence === 'daily') {
    nextDueDate.setDate(nextDueDate.getDate() + 1);
  } else if (recurrence === 'weekly') {
    nextDueDate.setDate(nextDueDate.getDate() + 7);
  } else if (recurrence === 'biweekly') {
    nextDueDate.setDate(nextDueDate.getDate() + 14);
  } else if (recurrence === 'monthly') {
    const dayOfMonth = recurrenceDay || nextDueDate.getDate();
    nextDueDate.setDate(1);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    const lastDayOfMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
    nextDueDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  }

  return nextDueDate;
};

function ChoreManagement({ parentId, children, chores, familyMembers = new Map(), getParentName = () => 'Unknown' }) {
  const [showAddChore, setShowAddChore] = useState(false);
  const [showEditChore, setShowEditChore] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [activeTab, setActiveTab] = useState('current'); // 'current', 'pending', or 'history'
  const [formData, setFormData] = useState({
    title: '',
    category: 'cleaning',
    location: '',
    customLocation: '',
    type: 'inside',
    reward: '',
    childId: '',
    instructions: '',
    dueDate: '',
    dueTime: '',
    recurrence: 'none'
  });
  const [loading, setLoading] = useState(false);
  const [checkingReminders, setCheckingReminders] = useState(false);

  // Check for upcoming due dates and send reminders
  const checkDueReminders = async () => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const upcomingChores = chores.filter(chore => {
      if (!chore.dueDate || chore.status !== 'assigned') return false;
      
      const dueDate = chore.dueDate.toDate();
      return dueDate <= oneHourFromNow && dueDate > now;
    });

    for (const chore of upcomingChores) {
      try {
        const child = children.find(c => c.id === chore.childId);
        if (child) {
          const dueDate = chore.dueDate.toDate();
          const timeRemaining = Math.round((dueDate - now) / (1000 * 60)); // minutes
          
          await notificationService.notifyChoreReminder(
            child.firstName,
            chore.title,
            timeRemaining
          );
        }
      } catch (error) {
        console.error('Error sending due reminder:', error);
      }
    }
  };

  const sendManualReminder = async (chore) => {
    try {
      setCheckingReminders(true);
      const child = children.find(c => c.id === chore.childId);
      if (child) {
        await notificationService.notifyManualReminder(
          child.firstName,
          chore.title,
          getParentName(parentId)
        );
        toast.success(`Reminder sent to ${child.firstName}! 📱`);
      }
    } catch (error) {
      console.error('Error sending manual reminder:', error);
      toast.error('Failed to send reminder');
    } finally {
      setCheckingReminders(false);
    }
  };

  const categories = [
    { value: 'cleaning', label: '🧽 Cleaning', icon: '🧽' },
    { value: 'dishes', label: '🍽️ Dishes', icon: '🍽️' },
    { value: 'laundry', label: '👕 Laundry', icon: '👕' },
    { value: 'outdoor', label: '🌱 Outdoor', icon: '🌱' },
    { value: 'pets', label: '🐕 Pets', icon: '🐕' },
    { value: 'organization', label: '📦 Organization', icon: '📦' },
    { value: 'homework', label: '📚 Homework', icon: '📚' },
    { value: 'other', label: '⭐ Other', icon: '⭐' }
  ];

  const locations = [
    'Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Laundry Room', 'Garage', 
    'Backyard', 'Front Yard', 'Basement', 'Attic', 'Dining Room', 'Custom'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const choreData = {
        title: formData.title,
        category: formData.category,
        location: formData.location === 'Custom' ? formData.customLocation : formData.location,
        type: formData.type,
        reward: Math.round((parseFloat(formData.reward) || 0) * 100) / 100,
        childId: formData.childId,
        parentId,
        createdBy: parentId, // Track who created this chore
        instructions: formData.instructions,
        status: 'assigned',
        createdAt: new Date(),
        recurrence: formData.recurrence
      };

      // Add due date if provided
      if (formData.dueDate && formData.dueDate.trim() !== '') {
        let dueDateTime;
        if (formData.dueTime && formData.dueTime.trim() !== '') {
          // Create date with specific time in local timezone
          dueDateTime = new Date(formData.dueDate + 'T' + formData.dueTime + ':00');
        } else {
          // Create date at end of day in local timezone (23:59:59)
          dueDateTime = new Date(formData.dueDate + 'T23:59:59');
        }
        choreData.dueDate = dueDateTime;
      }
      choreData.recurrenceDay = formData.recurrence === 'monthly' && choreData.dueDate
        ? choreData.dueDate.getDate()
        : null;

      await addDoc(collection(db, 'chores'), choreData);

      // Send notification about new chore
      try {
        const child = children.find(c => c.id === formData.childId);
        if (child) {
          // Determine if this chore was created by another parent (for multi-parent families)
          const createdByOtherParent = false; // For now, always false since current user is creating
          await notificationService.notifyChoreAssigned(
            child.firstName, 
            formData.title, 
            createdByOtherParent
          );
        }
      } catch (error) {
        console.error('Error sending chore notification:', error);
      }

      toast.success('Chore created successfully! 🧹');
      setFormData({
        title: '', category: 'cleaning', location: '', customLocation: '',
        type: 'inside', reward: '', childId: '', instructions: '', 
        dueDate: '', dueTime: '', recurrence: 'none'
      });
      setShowAddChore(false);
    } catch (error) {
      toast.error('Failed to create chore');
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (status) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getChoresByStatus = (status) => {
    return chores.filter(chore => chore.status === status);
  };

  // Get counters for tabs
  const getCurrentChoresCount = () => getChoresByStatus('assigned').length;
  const getPendingApprovalCount = () => getChoresByStatus('pending_approval').length;
  const getHistoryCount = () => chores.filter(chore => chore.completedAt || chore.approvedAt || chore.rejectedAt).length;
  
  // Get count of urgent chores (due within 24 hours)
  const getUrgentChoresCount = () => {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return chores.filter(chore => {
      if (!chore.dueDate || chore.status !== 'assigned') return false;
      const dueDate = chore.dueDate.toDate();
      return dueDate <= twentyFourHoursFromNow;
    }).length;
  };

  const getChildName = (childId) => {
    const child = children.find(c => c.id === childId);
    return child ? child.firstName : 'Unknown';
  };

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      awaiting_goal_selection: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusEmoji = (status) => {
    const emojis = {
      assigned: '📋',
      pending_approval: '⏳',
      approved: '✅',
      awaiting_goal_selection: '🎯',
      rejected: '❌'
    };
    return emojis[status] || '📋';
  };

  const scheduleNextRecurringChore = async (choreId, choreData) => {
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(choreData.recurrence)) return;

    const choreRef = doc(db, 'chores', choreId);
    const nextChoreRef = doc(collection(db, 'chores'));

    await runTransaction(db, async (transaction) => {
      const choreSnapshot = await transaction.get(choreRef);
      if (!choreSnapshot.exists()) return;

      const currentChore = choreSnapshot.data();
      if (currentChore.recurringNextChoreId || !['approved', 'awaiting_goal_selection'].includes(currentChore.status)) {
        return;
      }

      const recurrenceBaseDate = currentChore.dueDate || new Date();
      const recurrenceDay = currentChore.recurrence === 'monthly'
        ? currentChore.recurrenceDay || recurrenceBaseDate.getDate()
        : null;

      transaction.set(nextChoreRef, {
        title: currentChore.title,
        category: currentChore.category,
        location: currentChore.location || '',
        type: currentChore.type,
        reward: currentChore.reward || 0,
        childId: currentChore.childId,
        parentId: currentChore.parentId,
        createdBy: currentChore.createdBy || parentId,
        instructions: currentChore.instructions || '',
        status: 'assigned',
        createdAt: new Date(),
        dueDate: getNextDueDate(recurrenceBaseDate, currentChore.recurrence, recurrenceDay),
        recurrence: currentChore.recurrence,
        recurrenceDay
      });
      transaction.update(choreRef, {
        recurringNextChoreId: nextChoreRef.id,
        recurringNextChoreCreatedAt: new Date()
      });
    });
  };

  const deleteChore = async (choreId, choreTitle) => {
    if (window.confirm(`Are you sure you want to delete "${choreTitle}"? This action cannot be undone.`)) {
      try {
        // First, get the chore data to check if it was approved and get reward amount
        const choreRef = doc(db, 'chores', choreId);
        const choreDoc = await getDoc(choreRef);
        const choreData = choreDoc.data();

        // If the chore was approved, we need to subtract earnings from the child
        if (choreData && choreData.status === 'approved' && choreData.childId) {
          const childRef = doc(db, 'children', choreData.childId);
          const childDoc = await getDoc(childRef);
          
          if (childDoc.exists()) {
            const childData = childDoc.data();
            const newTotalEarnings = Math.max(0, (childData.totalEarnings || 0) - (choreData.reward || 0));
            
            // Update child's total earnings and remove from completed chores
            await updateDoc(childRef, {
              totalEarnings: newTotalEarnings,
              completedChores: arrayRemove(choreId)
            });
          }
        }

        // Delete the chore
        await deleteDoc(choreRef);
        toast.success('Chore deleted successfully! 🗑️');
      } catch (error) {
        console.error('Error deleting chore:', error);
        toast.error('Failed to delete chore');
      }
    }
  };

  const approveChore = async (choreId) => {
    try {
      const choreRef = doc(db, 'chores', choreId);
      const choreDoc = await getDoc(choreRef);
      const choreData = choreDoc.data();

      if (choreData) {
        if ((choreData.reward || 0) <= 0) {
          await updateDoc(choreRef, {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: parentId
          });
          toast.success('Mandatory chore approved! 🎉');
          try {
            await scheduleNextRecurringChore(choreId, choreData);
          } catch (error) {
            console.error('Error scheduling next recurring chore:', error);
            toast.error('Chore approved, but the next recurring chore could not be scheduled.');
          }
          return;
        }

        // Update child's total earnings immediately upon approval
        const childRef = doc(db, 'children', choreData.childId);
        const childDoc = await getDoc(childRef);
        
        if (childDoc.exists()) {
          const childData = childDoc.data();
          const currentEarnings = childData.totalEarnings || 0;
          const newTotalEarnings = currentEarnings + choreData.reward;
          
          await updateDoc(childRef, {
            totalEarnings: newTotalEarnings
          });
        }

        // Check if there's an auto-apply goal for this child
        const autoApplyGoalQuery = query(
          collection(db, 'goals'),
          where('childId', '==', choreData.childId),
          where('status', '==', 'active'),
          where('autoApply', '==', true),
          where('isMonetary', '==', true)
        );
        
        const autoApplyGoalSnapshot = await getDocs(autoApplyGoalQuery);
        
        if (!autoApplyGoalSnapshot.empty) {
          // There's an auto-apply goal, apply the reward directly
          const autoApplyGoal = autoApplyGoalSnapshot.docs[0];
          const goalData = autoApplyGoal.data();
          const goalRef = doc(db, 'goals', autoApplyGoal.id);
          
          const currentSavedAmount = goalData.savedAmount || 0;
          const targetAmount = goalData.targetAmount || 0;
          const remainingNeeded = Math.max(0, targetAmount - currentSavedAmount);
          
          if (choreData.reward >= remainingNeeded && remainingNeeded > 0) {
            // Goal will be completed with this reward
            await updateDoc(goalRef, {
              savedAmount: targetAmount,
              lastUpdated: new Date(),
              completedAt: new Date()
            });

            // Put any remainder in savings bucket
            const remainder = choreData.reward - remainingNeeded;
            if (remainder > 0) {
              const currentSavings = childData.savingsBucket || 0;
              await updateDoc(childRef, {
                savingsBucket: currentSavings + remainder
              });
            }

            // Mark chore as approved and completed
            await updateDoc(choreRef, {
              status: 'approved',
              approvedAt: new Date(),
              approvedBy: parentId,
              goalAppliedTo: autoApplyGoal.id,
              rewardAppliedAt: new Date()
            });

            toast.success(`🎉 Chore approved and goal "${goalData.title}" completed! ${remainder > 0 ? `$${remainder.toFixed(2)} added to savings.` : ''}`);
          } else {
            // Add to goal without completing it
            await updateDoc(goalRef, {
              savedAmount: currentSavedAmount + choreData.reward,
              lastUpdated: new Date()
            });

            // Mark chore as approved and completed
            await updateDoc(choreRef, {
              status: 'approved',
              approvedAt: new Date(),
              approvedBy: parentId,
              goalAppliedTo: autoApplyGoal.id,
              rewardAppliedAt: new Date()
            });

            toast.success(`Chore approved! $${choreData.reward.toFixed(2)} automatically added to "${goalData.title}" 🎯`);
          }
        } else {
          // No auto-apply goal, use the traditional flow
          await updateDoc(choreRef, {
            status: 'awaiting_goal_selection',
            approvedAt: new Date(),
            approvedBy: parentId
          });

          toast.success('Chore approved! Child can now choose which goal to apply the reward to 🎯');
        }

        try {
          await scheduleNextRecurringChore(choreId, choreData);
        } catch (error) {
          console.error('Error scheduling next recurring chore:', error);
          toast.error('Chore approved, but the next recurring chore could not be scheduled.');
        }
      }
    } catch (error) {
      console.error('Error approving chore:', error);
      toast.error('Failed to approve chore');
    }
  };

  const rejectChore = async (choreId, reason = 'Please try again') => {
    try {
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'assigned', // Reset to assigned so child can see it and try again
        rejectedAt: new Date(),
        rejectedBy: parentId,
        rejectionReason: reason
      });

      toast.success('Chore rejected and sent back to child 📤');
    } catch (error) {
      console.error('Error rejecting chore:', error);
      toast.error('Failed to reject chore');
    }
  };

  const startEditChore = (chore) => {
    setEditingChore(chore);
    
    // Check if the location is a predefined one or custom
    const predefinedLocations = ['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Laundry Room', 'Garage', 'Backyard', 'Front Yard', 'Basement', 'Attic', 'Dining Room'];
    const isCustomLocation = chore.location && !predefinedLocations.includes(chore.location);
    
    setFormData({
      title: chore.title,
      category: chore.category,
      location: isCustomLocation ? 'Custom' : (chore.location || ''),
      customLocation: isCustomLocation ? chore.location : '',
      type: chore.type,
      reward: chore.reward ? chore.reward.toString() : '',
      childId: chore.childId,
      instructions: chore.instructions || '',
      dueDate: chore.dueDate ? new Date(chore.dueDate.toDate()).toISOString().split('T')[0] : '',
      dueTime: chore.dueDate ? new Date(chore.dueDate.toDate()).toTimeString().slice(0, 5) : '',
      recurrence: chore.recurrence || 'none'
    });
    setShowEditChore(true);
  };

  const handleUpdateChore = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const choreRef = doc(db, 'chores', editingChore.id);
      
      const updateData = {
        title: formData.title,
        category: formData.category,
        location: formData.location === 'Custom' ? formData.customLocation : formData.location,
        type: formData.type,
        reward: Math.round((parseFloat(formData.reward) || 0) * 100) / 100,
        childId: formData.childId,
        instructions: formData.instructions,
        recurrence: formData.recurrence,
        updatedAt: new Date(),
        updatedBy: parentId
      };

      // Handle due date
      if (formData.dueDate && formData.dueDate.trim() !== '') {
        let dueDateTime;
        if (formData.dueTime && formData.dueTime.trim() !== '') {
          // Create date with specific time in local timezone
          dueDateTime = new Date(formData.dueDate + 'T' + formData.dueTime + ':00');
        } else {
          // Create date at end of day in local timezone (23:59:59)
          dueDateTime = new Date(formData.dueDate + 'T23:59:59');
        }
        updateData.dueDate = dueDateTime;
      } else {
        updateData.dueDate = null;
      }
      updateData.recurrenceDay = formData.recurrence === 'monthly' && updateData.dueDate
        ? updateData.dueDate.getDate()
        : null;

      // If chore is approved and reward amount changed, update child's earnings
      if (editingChore.status === 'approved') {
        const oldReward = editingChore.reward || 0;
        const newReward = Math.round((parseFloat(formData.reward) || 0) * 100) / 100;
        const rewardDifference = newReward - oldReward;

        if (rewardDifference !== 0) {
          // Update child's total earnings
          const childRef = doc(db, 'children', editingChore.childId);
          const childDoc = await getDoc(childRef);
          
          if (childDoc.exists()) {
            const childData = childDoc.data();
            const currentEarnings = childData.totalEarnings || 0;
            const newTotalEarnings = Math.max(0, currentEarnings + rewardDifference); // Ensure earnings don't go negative
            
            await updateDoc(childRef, {
              totalEarnings: newTotalEarnings
            });

            if (rewardDifference > 0) {
              toast.success(`Chore updated and $${rewardDifference.toFixed(2)} added to ${childData.firstName}'s earnings! 💰`);
            } else {
              toast.success(`Chore updated and $${Math.abs(rewardDifference).toFixed(2)} removed from ${childData.firstName}'s earnings! 💰`);
            }
          }
        }
      }

      await updateDoc(choreRef, updateData);

      if (editingChore.status !== 'approved') {
        toast.success('Chore updated successfully! ✏️');
      }
      
      setShowEditChore(false);
      setEditingChore(null);
      setFormData({
        title: '',
        category: 'cleaning',
        location: '',
        customLocation: '',
        type: 'inside',
        reward: '',
        childId: '',
        instructions: '',
        dueDate: '',
        dueTime: '',
        recurrence: 'none'
      });
    } catch (error) {
      console.error('Error updating chore:', error);
      toast.error('Failed to update chore');
    } finally {
      setLoading(false);
    }
  };

  // Auto-check for due reminders every 15 minutes
  useEffect(() => {
    const interval = setInterval(checkDueReminders, 15 * 60 * 1000); // 15 minutes
    
    // Also check immediately when component mounts
    checkDueReminders();
    
    return () => clearInterval(interval);
  }, [chores, children]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">🧹 Manage Chores</h2>
        <button
          onClick={() => setShowAddChore(true)}
          disabled={children.length === 0}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm"
        >
          ➕ Create Chore
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
            activeTab === 'current'
              ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          📋 Current Chores
          {getCurrentChoresCount() > 0 && (
            <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
              {getCurrentChoresCount()}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
            activeTab === 'pending'
              ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          ⏳ Pending Approval
          {getPendingApprovalCount() > 0 && (
            <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
              {getPendingApprovalCount()}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors text-sm ${
            activeTab === 'history'
              ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          📚 History
          {getHistoryCount() > 0 && (
            <span className="ml-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
              {getHistoryCount()}
            </span>
          )}
        </button>
      </div>

      {children.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">👶</div>
          <p className="text-yellow-800">Add children first before creating chores!</p>
        </div>
      )}
      
      {/* Add Chore Form */}
      {showAddChore && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Chore</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chore Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Clean your room"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Child *
                </label>
                <select
                  value={formData.childId}
                  onChange={(e) => setFormData({ ...formData, childId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            </div>

            {/* Category and Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-gray-500">(Optional)</span>
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => {
                    const selectedLocation = e.target.value;
                    const outdoorLocations = ['Backyard', 'Front Yard'];
                    const indoorLocations = ['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Laundry Room', 'Garage', 'Basement', 'Attic', 'Dining Room'];
                    
                    let newType = formData.type; // Keep current type by default
                    
                    if (outdoorLocations.includes(selectedLocation)) {
                      newType = 'outside';
                    } else if (indoorLocations.includes(selectedLocation)) {
                      newType = 'inside';
                    }
                    // For 'Custom' or empty selection, keep current type
                    
                    setFormData({ 
                      ...formData, 
                      location: selectedLocation,
                      type: newType
                    });
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select location (or leave blank)</option>
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
                {formData.location === 'Custom' && (
                  <input
                    type="text"
                    value={formData.customLocation}
                    onChange={(e) => setFormData({ ...formData, customLocation: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mt-2"
                    placeholder="Enter custom location..."
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="inside">🏠 Inside</option>
                  <option value="outside">🌳 Outside</option>
                </select>
              </div>
            </div>

            {/* Reward and Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Amount ($) <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.reward}
                  onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Leave blank for no reward"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Time (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {formData.dueTime && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dueTime: '' })}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Clear time"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repeat
                </label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {formData.recurrence !== 'none' && (
                  <p className="text-xs text-gray-500 mt-1">
                    The next chore is assigned after this one is approved.
                  </p>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows="3"
                placeholder="Any special instructions on how to complete this chore..."
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Chore'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddChore(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'current' && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Assigned Chores</h3>
          <ChoresList 
            chores={getChoresByStatus('assigned')} 
            children={children}
            getChildName={getChildName}
            getStatusColor={getStatusColor}
            getStatusEmoji={getStatusEmoji}
            getStatusDisplay={getStatusDisplay}
            onDelete={deleteChore}
            onEdit={startEditChore}
            getParentName={getParentName}
            onReminder={sendManualReminder}
            checkingReminders={checkingReminders}
          />
        </div>
      )}

      {activeTab === 'pending' && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">⏳ Pending Approval</h3>
          <ChoresList 
            chores={getChoresByStatus('pending_approval')} 
            children={children}
            getChildName={getChildName}
            getStatusColor={getStatusColor}
            getStatusEmoji={getStatusEmoji}
            getStatusDisplay={getStatusDisplay}
            onDelete={deleteChore}
            onEdit={startEditChore}
            onApprove={approveChore}
            onReject={rejectChore}
            getParentName={getParentName}
            onReminder={sendManualReminder}
            checkingReminders={checkingReminders}
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold text-purple-900 mb-2">Enhanced History Available</h3>
              <p className="text-purple-700 mb-4">
                For a better history experience with goal tracking and chore grouping, check out the Goals tab!
              </p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('switchToGoalsTab'))}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                📊 View Goals & History
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-gray-900">📚 All Completed Chores</h3>
            <p className="text-gray-600 mb-4">Basic list of completed chores (see Goals tab for organized history by goal)</p>
            
            <ChoreHistoryList 
              chores={chores.filter(chore => chore.completedAt || chore.approvedAt || chore.rejectedAt)} 
              getChildName={getChildName}
              getStatusColor={getStatusColor}
              getStatusEmoji={getStatusEmoji}
              getStatusDisplay={getStatusDisplay}
              onEdit={startEditChore}
              getParentName={getParentName}
            />
          </div>
        </div>
      )}

      {/* Edit Chore Modal */}
      {showEditChore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-900">✏️ Edit Chore</h3>
              <button
                onClick={() => {
                  setShowEditChore(false);
                  setEditingChore(null);
                  setFormData({
                    title: '',
                    category: 'cleaning',
                    location: '',
                    customLocation: '',
                    type: 'inside',
                    reward: '',
                    childId: '',
                    instructions: '',
                    dueDate: '',
                    dueTime: '',
                    recurrence: 'none'
                  });
                }}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
          <form onSubmit={handleUpdateChore} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chore Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Child *
                </label>
                <select
                  value={formData.childId}
                  onChange={(e) => setFormData({ ...formData, childId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-gray-500">(Optional)</span>
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => {
                    const selectedLocation = e.target.value;
                    const outdoorLocations = ['Backyard', 'Front Yard'];
                    const indoorLocations = ['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Laundry Room', 'Garage', 'Basement', 'Attic', 'Dining Room'];
                    
                    let newType = formData.type; // Keep current type by default
                    
                    if (outdoorLocations.includes(selectedLocation)) {
                      newType = 'outside';
                    } else if (indoorLocations.includes(selectedLocation)) {
                      newType = 'inside';
                    }
                    // For 'Custom' or empty selection, keep current type
                    
                    setFormData({ 
                      ...formData, 
                      location: selectedLocation,
                      type: newType
                    });
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select location (or leave blank)</option>
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
                {formData.location === 'Custom' && (
                  <input
                    type="text"
                    value={formData.customLocation}
                    onChange={(e) => setFormData({ ...formData, customLocation: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mt-2"
                    placeholder="Enter custom location..."
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="inside">🏠 Inside</option>
                  <option value="outside">🌿 Outside</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Amount ($) <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.reward}
                  onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Leave blank for no reward"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Time (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {formData.dueTime && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dueTime: '' })}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      title="Clear time"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repeat
                </label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {formData.recurrence !== 'none' && (
                  <p className="text-xs text-gray-500 mt-1">
                    The next chore is assigned after this one is approved.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows="3"
                placeholder="Any special instructions on how to complete this chore..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Chore'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete "${editingChore.title}"? This action cannot be undone.`)) {
                    deleteChore(editingChore.id, editingChore.title);
                    setShowEditChore(false);
                    setEditingChore(null);
                    setFormData({
                      title: '',
                      category: 'cleaning',
                      location: '',
                      customLocation: '',
                      type: 'inside',
                      reward: '',
                      childId: '',
                      instructions: '',
                      dueDate: '',
                      dueTime: '',
                      recurrence: 'none'
                    });
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                🗑️ Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditChore(false);
                  setEditingChore(null);
                  setFormData({
                    title: '',
                    category: 'cleaning',
                    location: '',
                    customLocation: '',
                    type: 'inside',
                    reward: '',
                    childId: '',
                    instructions: '',
                    dueDate: '',
                    dueTime: '',
                    recurrence: 'none'
                  });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoresList({ chores, getChildName, getStatusColor, getStatusEmoji, getStatusDisplay, onDelete, onEdit, onApprove, onReject, getParentName, onReminder, checkingReminders }) {
  if (chores.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-gray-600">No chores in this category</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chores.map(chore => (
        <div key={chore.id} className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-gray-900">{chore.title}</h4>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(chore.status)}`}>
                {getStatusEmoji(chore.status)} {getStatusDisplay(chore.status)}
              </span>
              
              {/* Show approve/reject buttons for pending approval chores */}
              {chore.status === 'pending_approval' && onApprove && onReject ? (
                <>
                  <button
                    onClick={() => onApprove(chore.id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                    title="Approve chore"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => onReject(chore.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                    title="Reject chore"
                  >
                    ❌ Reject
                  </button>
                </>
              ) : (
                <>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(chore)}
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 rounded-lg transition-colors"
                      title="Edit chore"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(chore.id, chore.title)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors"
                    title="Delete chore"
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          </div>
          
          {chore.description && <p className="text-gray-600 text-sm mb-3">{chore.description}</p>}
          
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
            <span>👤 {getChildName(chore.childId)}</span>
            {chore.location && <span>📍 {chore.location}</span>}
            <span>🏠 {chore.type}</span>
            <span>{(chore.reward || 0) > 0 ? `💰 $${chore.reward}` : '⭐ No reward'}</span>
            {['daily', 'weekly', 'biweekly', 'monthly'].includes(chore.recurrence) && (
              <span>🔁 {chore.recurrence}</span>
            )}
            {getParentName && (
              <span>
                👨‍👩‍👧‍👦 Set by: {getParentName(chore.createdBy || chore.parentId)}
                {chore.updatedBy && chore.updatedBy !== (chore.createdBy || chore.parentId) && (
                  <span className="text-blue-600"> • Edited by: {getParentName(chore.updatedBy)}</span>
                )}
              </span>
            )}
          </div>

          {chore.instructions && (
            <div className="bg-blue-50 rounded-lg p-2 mb-3">
              <p className="text-xs text-blue-800">
                <strong>Instructions:</strong> {chore.instructions}
              </p>
            </div>
          )}

          {chore.dueDate && (
            <div className="flex items-center justify-between">
              <p className={`text-xs ${(() => {
                const dueDateTime = new Date(chore.dueDate.toDate());
                const now = new Date();
                const hoursUntilDue = (dueDateTime - now) / (1000 * 60 * 60);
                
                if (hoursUntilDue < 0) return 'text-red-600 font-semibold'; // Overdue
                if (hoursUntilDue <= 1) return 'text-red-500 font-medium'; // Due within 1 hour
                if (hoursUntilDue <= 24) return 'text-orange-600'; // Due within 24 hours
                return 'text-orange-500'; // Future due date
              })()}`}>
                📅 Due: {new Date(chore.dueDate.toDate()).toLocaleDateString()}
                {(() => {
                  const dueDateTime = new Date(chore.dueDate.toDate());
                  const hours = dueDateTime.getHours();
                  const minutes = dueDateTime.getMinutes();
                  
                  // Don't show time for common "default" times that were likely unintended
                  const isDefaultTime = (hours === 0 && minutes === 0) ||  // midnight
                                      (hours === 19 && minutes === 0) ||  // 7 PM (common default)
                                      (hours === 12 && minutes === 0);    // noon (another common default)
                  
                  const timeString = !isDefaultTime ? 
                    ` at ${dueDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : '';
                  
                  // Add urgency indicator
                  const now = new Date();
                  const hoursUntilDue = (dueDateTime - now) / (1000 * 60 * 60);
                  
                  if (hoursUntilDue < 0) return timeString + ' ⚠️ OVERDUE';
                  if (hoursUntilDue <= 1) return timeString + ' 🚨 DUE SOON';
                  if (hoursUntilDue <= 24) return timeString + ' ⏰ Due Today';
                  
                  return timeString;
                })()}
              </p>
              {chore.dueDate && onReminder && (
                <button
                  onClick={() => onReminder(chore)}
                  disabled={checkingReminders}
                  className="ml-2 bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs transition-colors disabled:opacity-50"
                  title="Send reminder to child"
                >
                  {checkingReminders ? '⏳' : '🔔 Remind'}
                </button>
              )}

              {['daily', 'weekly', 'biweekly', 'monthly'].includes(chore.recurrence) && (
                <p className="text-xs text-blue-600 mt-1">
                  🔁 Repeats {chore.recurrence}
                </p>
              )}
            </div>
          )}

          {chore.completedAt && (
            <p className="text-xs text-green-600 mt-2">
              ✅ Completed: {new Date(chore.completedAt.toDate()).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ChoreHistoryList({ chores, getChildName, getStatusColor, getStatusEmoji, getStatusDisplay, onEdit, getParentName }) {
  if (chores.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">No history yet</h3>
        <p className="text-gray-600">Completed chores will appear here</p>
      </div>
    );
  }

  // Sort by completion date (newest first)
  const sortedChores = chores.sort((a, b) => {
    const aDate = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt || 0);
    const bDate = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt || 0);
    return bDate - aDate;
  });

  return (
    <div className="space-y-4">
      {sortedChores.map(chore => (
        <div key={chore.id} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-400">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-lg">{chore.title}</h4>
              <p className="text-gray-600 mt-1">{chore.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(chore.status)}`}>
                {getStatusEmoji(chore.status)} {getStatusDisplay(chore.status)}
              </span>
              {onEdit && (
                <button
                  onClick={() => onEdit(chore)}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 rounded-lg transition-colors"
                  title="Edit chore"
                >
                  ✏️
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600 mb-4">
            <div className="flex items-center space-x-2">
              <span>👤</span>
              <span className="font-medium">{getChildName(chore.childId)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>💰</span>
              <span className="font-medium text-green-600">
                {(chore.reward || 0) > 0 ? `$${chore.reward}` : 'No reward'}
              </span>
            </div>
            {chore.location && (
              <div className="flex items-center space-x-2">
                <span>📍</span>
                <span>{chore.location}</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span>🏠</span>
              <span>{chore.type}</span>
            </div>
            {getParentName && (
              <div className="flex items-center space-x-2">
                <span>👨‍👩‍👧‍👦</span>
                <span className="font-medium text-blue-600">
                  {getParentName(chore.createdBy || chore.parentId)}
                  {chore.updatedBy && chore.updatedBy !== (chore.createdBy || chore.parentId) && (
                    <span className="text-purple-600"> • Edited by: {getParentName(chore.updatedBy)}</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {chore.completedAt && (
            <div className="bg-green-50 rounded-lg p-3 mt-4">
              <p className="text-sm text-green-800">
                <strong>✅ Completed:</strong> {new Date(chore.completedAt.toDate()).toLocaleDateString()} at {new Date(chore.completedAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
          )}

          {chore.approvedAt && (
            <div className="bg-blue-50 rounded-lg p-3 mt-2">
              <p className="text-sm text-blue-800">
                <strong>👍 Approved:</strong> {new Date(chore.approvedAt.toDate()).toLocaleDateString()} at {new Date(chore.approvedAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
          )}

          {chore.rejectedAt && (
            <div className="bg-orange-50 rounded-lg p-3 mt-2">
              <p className="text-sm text-orange-800">
                <strong>🔄 Sent back for redo:</strong> {new Date(chore.rejectedAt.toDate()).toLocaleDateString()} at {new Date(chore.rejectedAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
              {chore.rejectionMessage && (
                <p className="text-sm text-orange-700 mt-1">
                  <strong>Message:</strong> {chore.rejectionMessage}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ChoreManagement;
