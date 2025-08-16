import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { deleteUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

function AdminPortal() {
  const [parents, setParents] = useState([]);
  const [children, setChildren] = useState([]);
  const [chores, setChores] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [deletedEmails, setDeletedEmails] = useState([]);
  const [selectedItems, setSelectedItems] = useState({
    parents: new Set(),
    children: new Set(),
    chores: new Set(),
    goals: new Set()
  });

  const fetchAllData = async () => {
    try {
      console.log('Fetching all database collections as admin user:', user?.email);
      
      // Fetch all collections
      const [parentsSnapshot, childrenSnapshot, choresSnapshot, goalsSnapshot] = await Promise.all([
        getDocs(collection(db, 'parents')),
        getDocs(collection(db, 'children')),
        getDocs(collection(db, 'chores')),
        getDocs(collection(db, 'goals'))
      ]);

      const parentData = parentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const childrenData = childrenSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const choresData = choresSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const goalsData = goalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setParents(parentData);
      setChildren(childrenData);
      setChores(choresData);
      setGoals(goalsData);

      console.log('Data loaded:', {
        parents: parentData.length,
        children: childrenData.length,
        chores: choresData.length,
        goals: goalsData.length
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }
  };

  const deleteAllData = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL data from the database! This action cannot be undone. Are you sure?')) {
      return;
    }

    if (!window.confirm('🚨 FINAL WARNING: This will permanently delete all parents, children, chores, and goals. Type DELETE in the next prompt to confirm.')) {
      return;
    }

    const confirmation = window.prompt('Type "DELETE" to confirm complete database wipe:');
    if (confirmation !== 'DELETE') {
      toast.error('Deletion cancelled - confirmation text did not match');
      return;
    }

    setDeleting(true);
    try {
      const batch = writeBatch(db);
      let deleteCount = 0;

      // Add all documents to batch delete
      [...parents, ...children, ...chores, ...goals].forEach(item => {
        let collectionName;
        if (parents.find(p => p.id === item.id)) collectionName = 'parents';
        else if (children.find(c => c.id === item.id)) collectionName = 'children';
        else if (chores.find(c => c.id === item.id)) collectionName = 'chores';
        else if (goals.find(g => g.id === item.id)) collectionName = 'goals';

        if (collectionName) {
          batch.delete(doc(db, collectionName, item.id));
          deleteCount++;
        }
      });

      await batch.commit();
      toast.success(`Successfully deleted ${deleteCount} documents!`);
      
      // Refresh data
      await fetchAllData();
      
      // Clear selections
      setSelectedItems({
        parents: new Set(),
        children: new Set(),
        chores: new Set(),
        goals: new Set()
      });

    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    const totalSelected = Array.from(selectedItems.parents).length + 
                         Array.from(selectedItems.children).length + 
                         Array.from(selectedItems.chores).length + 
                         Array.from(selectedItems.goals).length;

    if (totalSelected === 0) {
      toast.error('No items selected');
      return;
    }

    if (!window.confirm(`Delete ${totalSelected} selected items? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    const emailsToDelete = [];
    
    try {
      const batch = writeBatch(db);

      // Track parent emails before deleting
      selectedItems.parents.forEach(id => {
        const parent = parents.find(p => p.id === id);
        if (parent?.email) {
          emailsToDelete.push(parent.email);
        }
        batch.delete(doc(db, 'parents', id));
      });
      
      selectedItems.children.forEach(id => {
        batch.delete(doc(db, 'children', id));
      });
      selectedItems.chores.forEach(id => {
        batch.delete(doc(db, 'chores', id));
      });
      selectedItems.goals.forEach(id => {
        batch.delete(doc(db, 'goals', id));
      });

      await batch.commit();
      
      if (emailsToDelete.length > 0) {
        setDeletedEmails(prev => [...prev, ...emailsToDelete]);
        toast.success(`Successfully deleted ${totalSelected} items! ⚠️ Note: Firebase Auth accounts still exist for these emails.`);
      } else {
        toast.success(`Successfully deleted ${totalSelected} items!`);
      }
      
      // Refresh data
      await fetchAllData();
      
      // Clear selections
      setSelectedItems({
        parents: new Set(),
        children: new Set(),
        chores: new Set(),
        goals: new Set()
      });

    } catch (error) {
      console.error('Error deleting selected items:', error);
      toast.error('Failed to delete selected items');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelection = (collection, id) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev[collection]);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return {
        ...prev,
        [collection]: newSet
      };
    });
  };

  const selectAll = (collection) => {
    const items = collection === 'parents' ? parents :
                 collection === 'children' ? children :
                 collection === 'chores' ? chores : goals;
    
    setSelectedItems(prev => ({
      ...prev,
      [collection]: new Set(items.map(item => item.id))
    }));
  };

  const clearSelection = (collection) => {
    setSelectedItems(prev => ({
      ...prev,
      [collection]: new Set()
    }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (user?.email === 'coreynadeau1@gmail.com') {
        setLoading(true);
        await fetchAllData();
        setLoading(false);
      }
    };
    
    if (!authLoading) {
      loadData();
    }
  }, [user, authLoading]);

  if (authLoading) {
    return <div className="p-8">Checking authentication...</div>;
  }

  if (!user) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-red-800 mb-4">🚫 Access Denied</h1>
          <p className="text-red-700 mb-4">You must be logged in to access the admin portal.</p>
          <a 
            href="/login" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-block"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (user.email !== 'coreynadeau1@gmail.com') {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-red-800 mb-4">🚫 Access Denied</h1>
          <p className="text-red-700 mb-4">Only the system administrator can access this portal.</p>
          <p className="text-sm text-gray-600 mb-4">Logged in as: {user.email}</p>
          <a 
            href="/dashboard" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8">Loading admin data...</div>;
  }

  const totalDocuments = parents.length + children.length + chores.length + goals.length;
  const totalSelected = Array.from(selectedItems.parents).length + 
                       Array.from(selectedItems.children).length + 
                       Array.from(selectedItems.chores).length + 
                       Array.from(selectedItems.goals).length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 text-red-600">🔧 Admin Portal</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-bold text-red-800 mb-2">⚠️ Danger Zone</h2>
          <p className="text-red-700 mb-4">
            This admin portal allows you to delete data from the database. Use with caution!
          </p>
          <p className="text-sm text-red-600">
            <strong>Important:</strong> Deleting parent accounts only removes Firestore data. 
            Firebase Auth accounts remain and emails cannot be reused until manually deleted from Firebase Console.
          </p>
        </div>

        {deletedEmails.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-bold text-yellow-800 mb-2">🔑 Firebase Auth Cleanup Required</h2>
            <p className="text-yellow-700 mb-3">
              These emails still exist in Firebase Authentication and cannot be reused for new accounts:
            </p>
            <div className="bg-white rounded p-3 mb-3">
              {deletedEmails.map((email, index) => (
                <div key={index} className="font-mono text-sm text-gray-700 mb-1">
                  • {email}
                </div>
              ))}
            </div>
            <p className="text-sm text-yellow-600 mb-3">
              To reuse these emails, go to Firebase Console → Authentication → Users and manually delete these accounts.
            </p>
            <button
              onClick={() => setDeletedEmails([])}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 text-sm rounded transition-colors"
            >
              Clear List
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{parents.length}</div>
            <div className="text-gray-600">Parents</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{children.length}</div>
            <div className="text-gray-600">Children</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{chores.length}</div>
            <div className="text-gray-600">Chores</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{goals.length}</div>
            <div className="text-gray-600">Goals</div>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={fetchAllData}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            🔄 Refresh Data
          </button>
          
          {totalSelected > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : `🗑️ Delete Selected (${totalSelected})`}
            </button>
          )}

          <button
            onClick={deleteAllData}
            disabled={deleting || totalDocuments === 0}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : '💥 DELETE ALL DATA'}
          </button>
        </div>
      </div>

      {/* Parents Section */}
      <CollectionSection
        title="👨‍👩‍👧‍👦 Parents"
        items={parents}
        collectionName="parents"
        selectedItems={selectedItems.parents}
        onToggleSelection={toggleSelection}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        renderItem={(parent) => (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><strong>Family:</strong> {parent.familyName || 'N/A'}</div>
            <div><strong>Email:</strong> {parent.email || 'N/A'}</div>
            <div><strong>Code:</strong> {parent.shareCode || 'N/A'}</div>
          </div>
        )}
      />

      {/* Children Section */}
      <CollectionSection
        title="👶 Children"
        items={children}
        collectionName="children"
        selectedItems={selectedItems.children}
        onToggleSelection={toggleSelection}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        renderItem={(child) => (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><strong>Name:</strong> {child.firstName || 'N/A'}</div>
            <div><strong>Token:</strong> {child.token || 'N/A'}</div>
            <div><strong>Earnings:</strong> ${(child.totalEarnings || 0).toFixed(2)}</div>
          </div>
        )}
      />

      {/* Chores Section */}
      <CollectionSection
        title="🧹 Chores"
        items={chores}
        collectionName="chores"
        selectedItems={selectedItems.chores}
        onToggleSelection={toggleSelection}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        renderItem={(chore) => (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><strong>Title:</strong> {chore.title || 'N/A'}</div>
            <div><strong>Status:</strong> {chore.status || 'N/A'}</div>
            <div><strong>Reward:</strong> ${chore.reward || 0}</div>
          </div>
        )}
      />

      {/* Goals Section */}
      <CollectionSection
        title="🎯 Goals"
        items={goals}
        collectionName="goals"
        selectedItems={selectedItems.goals}
        onToggleSelection={toggleSelection}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        renderItem={(goal) => (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><strong>Description:</strong> {goal.goalDescription || 'N/A'}</div>
            <div><strong>Amount:</strong> ${(goal.goalAmount || 0).toFixed(2)}</div>
            <div><strong>Progress:</strong> ${(goal.currentAmount || 0).toFixed(2)}</div>
          </div>
        )}
      />
    </div>
  );
}

function CollectionSection({ title, items, collectionName, selectedItems, onToggleSelection, onSelectAll, onClearSelection, renderItem }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{title} ({items.length})</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onSelectAll(collectionName)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 text-sm rounded transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => onClearSelection(collectionName)}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 text-sm rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <div 
            key={item.id} 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedItems.has(item.id) 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => onToggleSelection(collectionName, item.id)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs text-gray-500 font-mono">{item.id}</div>
              <input 
                type="checkbox" 
                checked={selectedItems.has(item.id)}
                onChange={() => onToggleSelection(collectionName, item.id)}
                className="text-red-500"
              />
            </div>
            {renderItem(item)}
            <div className="text-xs text-gray-400 mt-2">
              Created: {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleString() : 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminPortal;
