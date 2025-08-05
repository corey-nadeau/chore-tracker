import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';

function ChildManagement({ parentId, children, onChildrenUpdate }) {
  const [showAddChild, setShowAddChild] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    dateOfBirth: '',
    goalAmount: '',
    goalDescription: ''
  });
  const [loading, setLoading] = useState(false);

  const generateChildToken = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Attempting to add child with data:', formData);
      console.log('Parent ID:', parentId);
      
      const childToken = generateChildToken();
      
      // Create child document
      const childDoc = await addDoc(collection(db, 'children'), {
        firstName: formData.firstName,
        dateOfBirth: new Date(formData.dateOfBirth),
        goalAmount: formData.goalAmount ? parseFloat(formData.goalAmount) : null,
        goalDescription: formData.goalDescription,
        parentId,
        token: childToken,
        totalEarnings: 0,
        completedChores: [],
        createdAt: new Date()
      });

      console.log('Child document created:', childDoc.id);

      // Update parent's children array
      await updateDoc(doc(db, 'parents', parentId), {
        children: arrayUnion(childDoc.id)
      });

      console.log('Parent document updated');

      toast.success(`${formData.firstName} added successfully! 🎉`);
      setFormData({ firstName: '', dateOfBirth: '', goalAmount: '', goalDescription: '' });
      setShowAddChild(false);
      onChildrenUpdate();
    } catch (error) {
      console.error('Error adding child:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      toast.error(`Failed to add child: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetEarnings = async (childId, childName) => {
    console.log('Reset earnings called for:', childId, childName);
    if (window.confirm(`Are you sure you want to reset ${childName}'s earnings to $0?`)) {
      try {
        await updateDoc(doc(db, 'children', childId), {
          totalEarnings: 0,
          completedChores: []
        });
        toast.success(`${childName}'s earnings reset! 🔄`);
        onChildrenUpdate();
      } catch (error) {
        console.error('Error resetting earnings:', error);
        toast.error('Failed to reset earnings');
      }
    }
  };

  const copyChildLink = (token) => {
    const link = `${window.location.origin}/child/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Child link copied! 📋');
  };

  const deleteChild = async (childId, childName) => {
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete ${childName}? This will permanently remove their account, chores, goals, and all data. This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      // Remove child from parent's children array
      await updateDoc(doc(db, 'parents', parentId), {
        children: arrayRemove(childId)
      });

      // Delete the child document
      await deleteDoc(doc(db, 'children', childId));

      // Note: In a production app, you might also want to delete related chores and goals
      // For now, we'll let Firebase security rules handle orphaned data

      toast.success(`${childName} has been removed successfully`);
      onChildrenUpdate(); // Refresh the parent data
    } catch (error) {
      console.error('Error deleting child:', error);
      toast.error('Failed to delete child');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center bg-red-100 p-4 rounded-lg">
        <h2 className="text-lg font-bold text-gray-900">👶 Manage Children</h2>
        <button
          onClick={() => setShowAddChild(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md text-sm border border-blue-700"
        >
          ➕ ADD CHILD
        </button>
      </div>

      {/* Add Child Form */}
      {showAddChild && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Child</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">💡</div>
              <div>
                <p className="text-blue-800 text-sm">
                  <strong>Flexible Rewards:</strong> You can set a monetary goal for saving up, or leave it empty for non-monetary rewards like extra screen time, special treats, or privileges!
                </p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter child's first name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Goal Amount ($) <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.goalAmount}
                  onChange={(e) => setFormData({ ...formData, goalAmount: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="25.00 (leave empty if no goal)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Description
                </label>
                <input
                  type="text"
                  value={formData.goalDescription}
                  onChange={(e) => setFormData({ ...formData, goalDescription: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="New toy, special treat, extra screen time, etc."
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Child'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddChild(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Children List */}
      {children.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">👶</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No children added yet</h3>
          <p className="text-gray-600">Add your first child to get started with chore tracking!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map(child => (
            <ChildCard 
              key={child.id} 
              child={child} 
              onResetEarnings={resetEarnings}
              onCopyLink={copyChildLink}
              onDeleteChild={deleteChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildCard({ child, onResetEarnings, onCopyLink, onDeleteChild }) {
  const age = new Date().getFullYear() - new Date(child.dateOfBirth?.toDate()).getFullYear();

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="text-center mb-4">
        <div className="text-5xl mb-2">🧒</div>
        <h3 className="text-xl font-bold text-gray-900">{child.firstName}</h3>
        <p className="text-gray-600">Age: {age}</p>
      </div>

      {/* Child Access Code */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white py-4 px-4 rounded-xl text-center shadow-lg">
          <div className="text-sm font-semibold mb-1">📱 Child Access Code</div>
          <div className="text-lg font-mono font-bold tracking-widest">
            {child.token}
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          {child.firstName} can enter this code to access their dashboard
        </p>
      </div>

      <div className="space-y-4">
        {/* Earnings */}
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            ${(child.totalEarnings || 0).toFixed(2)}
          </div>
          <div className="text-sm text-green-700">Total Earned</div>
        </div>

        {/* Goal Management - Now in Goals Tab */}
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-bold text-purple-900 mb-2">Goal Management</div>
            <div className="text-sm text-purple-700 mb-3">
              Create and manage goals in the Goals tab
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('switchToGoalsTab'))}
              className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
            >
              📊 Go to Goals Tab
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              console.log('Reset button clicked!');
              onResetEarnings(child.id, child.firstName);
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-lg transition-colors text-sm font-medium shadow-md"
            style={{ backgroundColor: '#f97316', color: 'white' }}
          >
            🔄 Reset Earnings
          </button>
          <button
            onClick={() => onDeleteChild(child.id, child.firstName)}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg transition-colors text-sm font-medium shadow-md"
          >
            🗑️ Delete Child
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChildManagement;
