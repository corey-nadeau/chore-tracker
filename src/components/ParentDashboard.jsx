import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';
import { PlusIcon, UserPlusIcon, ShareIcon, CogIcon } from '@heroicons/react/24/outline';
import ChildManagement from './ChildManagement';
import ChoreManagement from './ChoreManagement';
import GoalManagement from './GoalManagement';
import ShareFamily from './ShareFamily';

function ParentDashboard({ user }) {
  const [parentData, setParentData] = useState(null);
  const [children, setChildren] = useState([]);
  const [chores, setChores] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const childrenListenerRef = useRef(null);

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  useEffect(() => {
    fetchParentData();
    const unsubscribeChores = setupChoresListener();
    
    // Goals tab switch handler
    const handleSwitchToGoalsTab = () => {
      setActiveTab('goals');
    };
    
    window.addEventListener('switchToGoalsTab', handleSwitchToGoalsTab);
    
    // PWA Install prompt handler
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Show guidance toast only once using a ref to prevent React.StrictMode double execution
    const timer = setTimeout(() => {
      if (!window.choreTrackerWelcomeShown) {
        toast('👋 Click on "Children" or "Chores" tabs to add data!', {
          duration: 6000,
          style: {
            background: '#0ea5e9',
            color: '#fff',
          }
        });
        window.choreTrackerWelcomeShown = true;
      }
    }, 2000);

    return () => {
      if (unsubscribeChores) unsubscribeChores();
      if (childrenListenerRef.current) childrenListenerRef.current();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('switchToGoalsTab', handleSwitchToGoalsTab);
      clearTimeout(timer);
    };
  }, [user]);

  const fetchParentData = async () => {
    try {
      console.log('Fetching data for user:', user.uid);
      const parentDoc = await getDoc(doc(db, 'parents', user.uid));
      
      if (parentDoc.exists()) {
        const data = parentDoc.data();
        console.log('Parent data:', data);
        setParentData(data);
        
        // Set up children listener
        if (data.children && data.children.length > 0) {
          childrenListenerRef.current = setupChildrenListener(data.children);
        }
      } else {
        console.log('No parent document found, creating one...');
        // Create a basic parent document if it doesn't exist
        const newParentData = {
          email: user.email,
          familyName: 'My Family',
          children: [],
          shareCode: generateShareCode(),
          createdAt: new Date()
        };
        
        await setDoc(doc(db, 'parents', user.uid), newParentData);
        setParentData(newParentData);
        toast.success('Family account set up successfully! 🎉');
      }
    } catch (error) {
      console.error('Error fetching parent data:', error);
      toast.error(`Failed to load family data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setupChoresListener = () => {
    try {
      const q = query(
        collection(db, 'chores'),
        where('parentId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const choresData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort in JavaScript instead of Firestore to avoid index requirement
        choresData.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bDate - aDate;
        });
        
        setChores(choresData);
        console.log('Parent chores updated:', choresData.length, 'chores');
      }, (error) => {
        console.error('Error setting up chores listener:', error);
        toast.error(`Failed to load chores: ${error.message}`);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error creating chores query:', error);
      toast.error(`Failed to set up chores listener: ${error.message}`);
    }
  };

  const setupChildrenListener = (childrenIds) => {
    try {
      if (!childrenIds || childrenIds.length === 0) {
        setChildren([]);
        return;
      }

      const q = query(
        collection(db, 'children'),
        where('__name__', 'in', childrenIds)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const childrenData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by creation date
        childrenData.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return aDate - bDate;
        });
        
        setChildren(childrenData);
        console.log('Parent children updated:', childrenData.length, 'children');
      }, (error) => {
        console.error('Error setting up children listener:', error);
        toast.error(`Failed to load children: ${error.message}`);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error creating children query:', error);
      toast.error(`Failed to set up children listener: ${error.message}`);
      setChildren([]);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App installed successfully! 🎉');
      }
      
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  const approveChore = async (choreId, childId) => {
    try {
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: user.uid
      });

      // Update child's earnings
      const childRef = doc(db, 'children', childId);
      const childDoc = await getDoc(childRef);
      const childData = childDoc.data();
      const chore = chores.find(c => c.id === choreId);
      
      const newTotalEarnings = (childData.totalEarnings || 0) + chore.reward;
      
      await updateDoc(childRef, {
        totalEarnings: newTotalEarnings,
        completedChores: arrayUnion(choreId)
      });

      // Check if any goals are completed
      const goalsQuery = query(
        collection(db, 'goals'),
        where('childId', '==', childId),
        where('status', '==', 'active')
      );
      
      const goalsSnapshot = await getDocs(goalsQuery);
      
      goalsSnapshot.docs.forEach(async (goalDoc) => {
        const goal = goalDoc.data();
        if (goal.isMonetary && newTotalEarnings >= goal.targetAmount) {
          toast.success(`🎉 ${childData.firstName} has reached their goal: ${goal.title}! Check the Goals tab to complete it.`);
        }
      });

      toast.success('Chore approved! 🎉');
    } catch (error) {
      toast.error('Failed to approve chore');
    }
  };

  const rejectChore = async (choreId) => {
    const customMessage = prompt(
      "Optional: Add a message for your child (or leave blank for default message):", 
      "It looks like you need to try this again! 🔄"
    );
    
    // If user clicks cancel, don't reject the chore
    if (customMessage === null) return;
    
    try {
      const choreRef = doc(db, 'chores', choreId);
      await updateDoc(choreRef, {
        status: 'assigned', // Send back to child to redo
        rejectedAt: new Date(),
        rejectedBy: user.uid,
        rejectionMessage: customMessage || "It looks like you need to try this again! 🔄"
      });

      toast.success('Chore sent back to child to try again! 🔄');
    } catch (error) {
      toast.error('Failed to reject chore');
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  const pendingChores = chores.filter(chore => chore.status === 'pending_approval');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                👨‍👩‍👧‍👦 {parentData?.familyName || 'Family'} Dashboard
              </h1>
              <p className="text-xs text-gray-600">Manage chores and track progress</p>
            </div>
            <div className="flex space-x-2">
              {showInstallButton && (
                <button
                  onClick={handleInstallApp}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium text-sm"
                >
                  📱 Install App
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 justify-center sm:justify-start">
          {[
            { id: 'dashboard', label: '📊 Dashboard', shortLabel: '📊', icon: '📊', color: 'bg-blue-500 hover:bg-blue-600 text-white' },
            { id: 'children', label: '👶 Children', shortLabel: '👶', icon: UserPlusIcon, color: 'bg-green-500 hover:bg-green-600 text-white' },
            { id: 'chores', label: '🧹 Chores', shortLabel: '🧹', icon: PlusIcon, color: 'bg-purple-500 hover:bg-purple-600 text-white' },
            { id: 'goals', label: '🎯 Goals', shortLabel: '🎯', icon: '🎯', color: 'bg-orange-500 hover:bg-orange-600 text-white' },
            { id: 'share', label: '📤 Share', shortLabel: '📤', icon: ShareIcon, color: 'bg-pink-500 hover:bg-pink-600 text-white' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold transition-all duration-200 text-xs sm:text-base flex-shrink-0 shadow-md ${
                activeTab === tab.id
                  ? `${tab.color} shadow-2xl transform scale-105 ring-2 ring-white`
                  : tab.color.replace('hover:', '') + ' opacity-80'
              }`}
              style={{
                backgroundColor: activeTab === tab.id 
                  ? (tab.id === 'dashboard' ? '#3b82f6' : 
                     tab.id === 'children' ? '#10b981' : 
                     tab.id === 'chores' ? '#8b5cf6' : 
                     tab.id === 'goals' ? '#f97316' : '#ec4899')
                  : (tab.id === 'dashboard' ? '#3b82f6' : 
                     tab.id === 'children' ? '#10b981' : 
                     tab.id === 'chores' ? '#8b5cf6' : 
                     tab.id === 'goals' ? '#f97316' : '#ec4899'),
                opacity: activeTab === tab.id ? 1 : 0.8
              }}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-3">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">👶</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-gray-900">{children.length}</div>
                    <div className="text-gray-600 text-sm">Children</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">🧹</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-gray-900">{chores.length}</div>
                    <div className="text-gray-600 text-sm">Total Chores</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">⏳</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-orange-600">{pendingChores.length}</div>
                    <div className="text-gray-600 text-sm">Pending Approval</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">💰</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-green-600">
                      ${children.reduce((total, child) => total + (child.totalEarnings || 0), 0).toFixed(2)}
                    </div>
                    <div className="text-gray-600 text-sm">Total Earned</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Approvals */}
            {pendingChores.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">⏳ Pending Approvals</h2>
                <div className="space-y-4">
                  {pendingChores.map(chore => {
                    const child = children.find(c => c.id === chore.childId);
                    return (
                      <div key={chore.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div>
                          <h3 className="font-medium">{chore.title}</h3>
                          <p className="text-sm text-gray-600">
                            {child?.firstName} • ${chore.reward} • {chore.location}
                          </p>
                          <p className="text-xs text-gray-500">
                            Completed: {new Date(chore.completedAt?.toDate()).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => approveChore(chore.id, chore.childId)}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => rejectChore(chore.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            🔄 Try Again
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Children Progress */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3">👶 Children Progress</h2>
              {children.length === 0 ? (
                <p className="text-gray-600">No children added yet. Click on the Children tab to add your first child!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {children.map(child => (
                    <div key={child.id} className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-xl p-4">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🧒</div>
                        <h3 className="text-lg font-bold text-gray-900">{child.firstName}</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Age: {new Date().getFullYear() - new Date(child.dateOfBirth?.toDate()).getFullYear()}
                        </p>
                        <div className="bg-white rounded-lg p-4">
                          <div className="text-2xl font-bold text-green-600">
                            ${(child.totalEarnings || 0).toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600">Total Earned</div>
                        </div>
                        <div className="mt-4">
                          <div className="text-sm text-gray-500 text-center">
                            💡 Manage goals in the Goals tab
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'children' && (
          <ChildManagement 
            parentId={user.uid} 
            children={children} 
            onChildrenUpdate={fetchParentData} 
          />
        )}

        {activeTab === 'chores' && (
          <ChoreManagement 
            parentId={user.uid} 
            children={children} 
            chores={chores}
          />
        )}

        {activeTab === 'goals' && (
          <GoalManagement 
            parentId={user.uid} 
            children={children} 
            chores={chores}
          />
        )}

        {activeTab === 'share' && (
          <ShareFamily 
            shareCode={parentData?.shareCode}
            parentId={user.uid}
          />
        )}
      </div>
    </div>
  );
}

export default ParentDashboard;
