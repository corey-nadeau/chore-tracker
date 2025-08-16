import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';

function ChildManagement({ parentId, children, onChildrenUpdate, familyMembers = new Map() }) {
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    dateOfBirth: ''
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
        parentId,
        token: childToken,
        totalEarnings: 0,
        completedChores: [],
        createdAt: new Date()
      });

      console.log('Child document created:', childDoc.id);

      // Update only the current parent's children array (security rules prevent updating others)
      await updateDoc(doc(db, 'parents', parentId), {
        children: arrayUnion(childDoc.id)
      });
      
      console.log('Updated current parent with new child');

      toast.success(`${formData.firstName} added successfully! 🎉 Other family members will see the child when they refresh.`);
      setFormData({ firstName: '', dateOfBirth: '' });
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
      // Get current parent's data to find all family members
      const parentDoc = await getDoc(doc(db, 'parents', parentId));
      const parentData = parentDoc.data();
      const allFamilyMembers = parentData?.familyMembers || [parentId];

      // Remove child from all family members' children arrays
      for (const memberId of allFamilyMembers) {
        try {
          await updateDoc(doc(db, 'parents', memberId), {
            children: arrayRemove(childId)
          });
          console.log(`Removed child from parent ${memberId}`);
        } catch (error) {
          console.error(`Error updating parent ${memberId}:`, error);
        }
      }

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

  const startEditChild = (child) => {
    setEditingChild(child);
    setFormData({
      firstName: child.firstName,
      dateOfBirth: child.dateOfBirth ? new Date(child.dateOfBirth.toDate()).toISOString().split('T')[0] : ''
    });
    setShowEditChild(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {
        firstName: formData.firstName,
        dateOfBirth: new Date(formData.dateOfBirth),
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'children', editingChild.id), updateData);

      toast.success(`${formData.firstName}'s information updated successfully! 🎉`);
      setFormData({ firstName: '', dateOfBirth: '' });
      setShowEditChild(false);
      setEditingChild(null);
      onChildrenUpdate();
    } catch (error) {
      console.error('Error updating child:', error);
      toast.error(`Failed to update child: ${error.message}`);
    } finally {
      setLoading(false);
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
                  <strong>Quick Setup:</strong> Just add your child's name and birthday to get started! You can create goals and rewards later in the Goals tab.
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

      {/* Edit Child Form */}
      {showEditChild && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Edit {editingChild?.firstName}'s Information</h3>
          
          <form onSubmit={handleEditSubmit} className="space-y-4">
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

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Child'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditChild(false);
                  setEditingChild(null);
                  setFormData({ firstName: '', dateOfBirth: '' });
                }}
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
        <div className={`grid gap-6 ${
          children.length === 1 
            ? 'grid-cols-1 max-w-lg mx-auto' 
            : children.length === 2 
              ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' 
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {children.map(child => (
            <ChildCard 
              key={child.id} 
              child={child} 
              onResetEarnings={resetEarnings}
              onCopyLink={copyChildLink}
              onDeleteChild={deleteChild}
              onEditChild={startEditChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildCard({ child, onResetEarnings, onCopyLink, onDeleteChild, onEditChild }) {
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

      {/* Child Link Info */}
      <div className="mb-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="text-center mb-3">
          <div className="text-sm font-medium text-blue-900 mb-2">🔗 Direct Link Access</div>
          <div className="text-xs text-blue-700 mb-3">
            Copy the direct link to create a shortcut on {child.firstName}'s device
          </div>
        </div>
        
        {/* Display the actual link */}
        <div className="bg-white rounded-lg p-3 border border-blue-200 mb-3">
          <div className="text-xs text-gray-500 mb-1">Child's Direct Link:</div>
          <div className="text-sm font-mono text-blue-600 break-all select-all">
            {window.location.origin}/child/{child.token}
          </div>
        </div>
        
        {/* Quick copy button */}
        <button
          onClick={() => onCopyLink(child.token)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg transition-colors text-sm font-medium"
        >
          📋 Copy This Link
        </button>
      </div>

      <div className="space-y-4">
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => onEditChild(child)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors text-sm font-medium shadow-md"
          >
            ✏️ Edit Information
          </button>
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
