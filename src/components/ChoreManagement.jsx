import { useState } from 'react';
import { collection, addDoc, doc, deleteDoc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function ChoreManagement({ parentId, children, chores }) {
  const [showAddChore, setShowAddChore] = useState(false);
  const [showEditChore, setShowEditChore] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'history'
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'cleaning',
    location: '',
    type: 'inside',
    reward: '',
    childId: '',
    instructions: '',
    dueDate: '',
    dueTime: ''
  });
  const [loading, setLoading] = useState(false);

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
    'Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Garage', 
    'Backyard', 'Front Yard', 'Basement', 'Attic', 'Dining Room', 'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const choreData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: formData.location,
        type: formData.type,
        reward: Math.round(parseFloat(formData.reward) * 100) / 100,
        childId: formData.childId,
        parentId,
        instructions: formData.instructions,
        status: 'assigned',
        createdAt: new Date()
      };

      // Add due date if provided
      if (formData.dueDate) {
        let dueDateTime = new Date(formData.dueDate);
        if (formData.dueTime) {
          const [hours, minutes] = formData.dueTime.split(':');
          dueDateTime.setHours(parseInt(hours), parseInt(minutes));
        }
        choreData.dueDate = dueDateTime;
      }

      await addDoc(collection(db, 'chores'), choreData);

      toast.success('Chore created successfully! 🧹');
      setFormData({
        title: '', description: '', category: 'cleaning', location: '', 
        type: 'inside', reward: '', childId: '', instructions: '', 
        dueDate: '', dueTime: ''
      });
      setShowAddChore(false);
    } catch (error) {
      toast.error('Failed to create chore');
    } finally {
      setLoading(false);
    }
  };

  const getChoresByStatus = (status) => {
    return chores.filter(chore => chore.status === status);
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
            const newTotalEarnings = Math.max(0, (childData.totalEarnings || 0) - choreData.reward);
            
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
      await updateDoc(choreRef, {
        status: 'awaiting_goal_selection',
        approvedAt: new Date(),
        approvedBy: parentId
      });

      toast.success('Chore approved! Child can now choose which goal to apply the reward to 🎯');
    } catch (error) {
      console.error('Error approving chore:', error);
      toast.error('Failed to approve chore');
    }
  };

  const rejectChore = async (choreId, reason = 'Please try again') => {
    try {
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'rejected',
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
    setFormData({
      title: chore.title,
      description: chore.description,
      category: chore.category,
      location: chore.location,
      type: chore.type,
      reward: chore.reward.toString(),
      childId: chore.childId,
      instructions: chore.instructions || '',
      dueDate: chore.dueDate ? new Date(chore.dueDate.toDate()).toISOString().split('T')[0] : '',
      dueTime: chore.dueDate ? new Date(chore.dueDate.toDate()).toTimeString().slice(0, 5) : ''
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
        description: formData.description,
        category: formData.category,
        location: formData.location,
        type: formData.type,
        reward: Math.round(parseFloat(formData.reward) * 100) / 100,
        childId: formData.childId,
        instructions: formData.instructions,
        updatedAt: new Date(),
        updatedBy: parentId
      };

      // Handle due date
      if (formData.dueDate) {
        let dueDateTime = new Date(formData.dueDate);
        if (formData.dueTime) {
          const [hours, minutes] = formData.dueTime.split(':');
          dueDateTime.setHours(parseInt(hours), parseInt(minutes));
        }
        updateData.dueDate = dueDateTime;
      } else {
        updateData.dueDate = null;
      }

      // If chore is approved and reward amount changed, update child's earnings
      if (editingChore.status === 'approved') {
        const oldReward = editingChore.reward;
        const newReward = Math.round(parseFloat(formData.reward) * 100) / 100;
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
        description: '',
        category: 'cleaning',
        location: '',
        type: 'inside',
        reward: '',
        childId: '',
        instructions: '',
        dueDate: '',
        dueTime: ''
      });
    } catch (error) {
      console.error('Error updating chore:', error);
      toast.error('Failed to update chore');
    } finally {
      setLoading(false);
    }
  };

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
        </button>
      </div>

      {children.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">👶</div>
          <p className="text-yellow-800">Add children first before creating chores!</p>
        </div>
      )}      {/* Add Chore Form */}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows="3"
                placeholder="What needs to be done?"
              />
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
                  Location *
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select location</option>
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.reward}
                  onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="5.00"
                  required
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
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
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

      {/* Edit Chore Form */}
      {showEditChore && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">✏️ Edit Chore</h3>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows="3"
              />
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
                  Location *
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select location</option>
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.reward}
                  onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
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
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
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
                      description: '',
                      category: 'cleaning',
                      location: '',
                      type: 'inside',
                      reward: '',
                      childId: '',
                      instructions: '',
                      dueDate: '',
                      dueTime: ''
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
                    description: '',
                    category: 'cleaning',
                    location: '',
                    type: 'inside',
                    reward: '',
                    childId: '',
                    instructions: '',
                    dueDate: '',
                    dueTime: ''
                  });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'current' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assigned Chores */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Assigned Chores</h3>
            <ChoresList 
              chores={getChoresByStatus('assigned')} 
              children={children}
              getChildName={getChildName}
              getStatusColor={getStatusColor}
              getStatusEmoji={getStatusEmoji}
              onDelete={deleteChore}
              onEdit={startEditChore}
            />
          </div>

          {/* Pending Approval */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">⏳ Pending Approval</h3>
            <ChoresList 
              chores={getChoresByStatus('pending_approval')} 
              children={children}
              getChildName={getChildName}
              getStatusColor={getStatusColor}
              getStatusEmoji={getStatusEmoji}
              onDelete={deleteChore}
              onEdit={startEditChore}
              onApprove={approveChore}
              onReject={rejectChore}
            />
          </div>
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
              chores={[...getChoresByStatus('approved'), ...getChoresByStatus('awaiting_goal_selection'), ...getChoresByStatus('rejected')]} 
              children={children}
              getChildName={getChildName}
              getStatusColor={getStatusColor}
              getStatusEmoji={getStatusEmoji}
              onEdit={startEditChore}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ChoresList({ chores, getChildName, getStatusColor, getStatusEmoji, onDelete, onEdit, onApprove, onReject }) {
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
                {getStatusEmoji(chore.status)} {chore.status.replace('_', ' ').toUpperCase()}
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
          
          <p className="text-gray-600 text-sm mb-3">{chore.description}</p>
          
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
            <span>👤 {getChildName(chore.childId)}</span>
            <span>📍 {chore.location}</span>
            <span>🏠 {chore.type}</span>
            <span>💰 ${chore.reward}</span>
          </div>

          {chore.instructions && (
            <div className="bg-blue-50 rounded-lg p-2 mb-3">
              <p className="text-xs text-blue-800">
                <strong>Instructions:</strong> {chore.instructions}
              </p>
            </div>
          )}

          {chore.dueDate && (
            <p className="text-xs text-orange-600">
              📅 Due: {new Date(chore.dueDate.toDate()).toLocaleDateString()}
              {new Date(chore.dueDate.toDate()).toLocaleTimeString() !== '12:00:00 AM' && 
                ` at ${new Date(chore.dueDate.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
              }
            </p>
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

function ChoreHistoryList({ chores, getChildName, getStatusColor, getStatusEmoji, onEdit }) {
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
                {getStatusEmoji(chore.status)} {chore.status.replace('_', ' ').toUpperCase()}
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
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
            <div className="flex items-center space-x-2">
              <span>👤</span>
              <span className="font-medium">{getChildName(chore.childId)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>💰</span>
              <span className="font-medium text-green-600">${chore.reward}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>📍</span>
              <span>{chore.location}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🏠</span>
              <span>{chore.type}</span>
            </div>
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
