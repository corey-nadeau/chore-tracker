import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, addDoc, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';
import { PlusIcon, UserPlusIcon, ShareIcon, CogIcon } from '@heroicons/react/24/outline';
import notificationService from '../services/notificationService';
import ChildManagement from './ChildManagement';
import ChoreManagement from './ChoreManagement';
import GoalManagement from './GoalManagement';
import ShareFamily from './ShareFamily';
import FamilyDebug from './FamilyDebug';
import Settings from './Settings';

function ParentDashboard({ user }) {
  const [parentData, setParentData] = useState(null);
  const [children, setChildren] = useState([]);
  const [chores, setChores] = useState([]);
  const [familyMembers, setFamilyMembers] = useState(new Map()); // Store family member info
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const childrenListenerRef = useRef(null);

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const getAllFamilyChildren = async (familyMembers) => {
    try {
      // Get all children that belong to any family member
      const allChildrenQuery = await getDocs(collection(db, 'children'));
      const allChildren = allChildrenQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const familyChildren = allChildren.filter(child => familyMembers.includes(child.parentId));
      
      console.log(`Found ${familyChildren.length} family children`);
      return familyChildren;
    } catch (error) {
      console.error('Error getting family children:', error);
      return [];
    }
  };

  const smartFamilySync = async (currentParentData) => {
    try {
      console.log('🔍 Smart family sync - detecting family by shareCode:', currentParentData.shareCode);
      
      // Find ALL parents who share the same shareCode (this is how family members are linked)
      const allParentsQuery = await getDocs(collection(db, 'parents'));
      const familyParents = allParentsQuery.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(parent => parent.shareCode === currentParentData.shareCode);
      
      const familyMemberIds = familyParents.map(parent => parent.id);
      console.log('🔍 Found', familyMemberIds.length, 'family members');
      
      // Get all children that belong to ANY family member
      const allChildrenQuery = await getDocs(collection(db, 'children'));
      const familyChildren = allChildrenQuery.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(child => familyMemberIds.includes(child.parentId));
      
      console.log('🔍 Found', familyChildren.length, 'family children');
      
      const correctChildIds = familyChildren.map(child => child.id);
      
      // Update current user's document with the correct children and family members
      const currentChildIds = currentParentData.children || [];
      const needsSync = correctChildIds.length !== currentChildIds.length || 
                       !correctChildIds.every(id => currentChildIds.includes(id));
      
      if (needsSync) {
        console.log('🔧 Syncing family data - updating with', correctChildIds.length, 'children');
        
        await updateDoc(doc(db, 'parents', user.uid), {
          children: correctChildIds,
          familyMembers: familyMemberIds
        });
        
        console.log('✅ Family sync completed');
        
        // Update local state
        setParentData(prev => ({ ...prev, children: correctChildIds, familyMembers: familyMemberIds }));
      } else {
        console.log('✅ Family data already in sync');
      }
      
      return familyMemberIds;
    } catch (error) {
      console.error('❌ Error in smart family sync:', error);
      return [user.uid];
    }
  };

  const syncFamilyChildren = async (familyMembers, currentParentData) => {
    try {
      console.log('Syncing family children for', familyMembers.length, 'members');
      
      // Get ALL family members from ALL parent documents to ensure we have the complete list
      const allFamilyMemberIds = new Set();
      
      // First, add the provided family members
      familyMembers.forEach(id => allFamilyMemberIds.add(id));
      
      for (const memberId of familyMembers) {
        try {
          const memberDoc = await getDoc(doc(db, 'parents', memberId));
          if (memberDoc.exists()) {
            const memberData = memberDoc.data();
            // Add all family members from this parent's document
            if (memberData.familyMembers) {
              memberData.familyMembers.forEach(id => allFamilyMemberIds.add(id));
            }
          }
        } catch (error) {
          console.error(`Error getting family members from ${memberId}:`, error);
        }
      }
      
      const completeFamilyMembers = Array.from(allFamilyMemberIds);
      
      // Get all children that belong to the complete family
      const familyChildren = await getAllFamilyChildren(completeFamilyMembers);
      const correctChildIds = familyChildren.map(child => child.id);
      
      // Check if current user's children array needs updating
      const currentChildIds = currentParentData.children || [];
      const needsSync = correctChildIds.length !== currentChildIds.length || 
                       !correctChildIds.every(id => currentChildIds.includes(id));
      
      if (needsSync) {
        console.log('Updating children array with', correctChildIds.length, 'children');
        await updateDoc(doc(db, 'parents', user.uid), {
          children: correctChildIds
        });
        console.log('✅ Children sync completed');
        
        // Update local state
        setParentData(prev => ({ ...prev, children: correctChildIds }));
      }
      
      return completeFamilyMembers;
    } catch (error) {
      console.error('Error syncing family children:', error);
      return familyMembers;
    }
  };

  useEffect(() => {
    fetchParentData();
    
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
    
    // Show guidance toast only once per user and only if they have no data yet
    const timer = setTimeout(() => {
      const welcomeKey = `choreTracker_welcome_${user?.uid}`;
      const hasSeenWelcome = localStorage.getItem(welcomeKey);
      
      // Only show if user hasn't seen it AND they have no children/chores yet
      if (!hasSeenWelcome && children.length === 0 && chores.length === 0) {
        toast('👋 Click on "Children" or "Chores" tabs to add data!', {
          duration: 6000,
          style: {
            background: '#0ea5e9',
            color: '#fff',
          }
        });
        localStorage.setItem(welcomeKey, 'true');
      }
    }, 2000);

    return () => {
      if (childrenListenerRef.current) childrenListenerRef.current();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('switchToGoalsTab', handleSwitchToGoalsTab);
      clearTimeout(timer);
    };
  }, [user]);

  // Set up chores listener when parentData is available
  useEffect(() => {
    if (parentData) {
      const unsubscribeChores = setupChoresListener();
      return () => {
        if (unsubscribeChores) unsubscribeChores();
      };
    }
  }, [parentData]);

  const fetchParentData = async () => {
    try {
      console.log('Fetching parent data...');
      const parentDoc = await getDoc(doc(db, 'parents', user.uid));
      
      if (parentDoc.exists()) {
        const data = parentDoc.data();
        setParentData(data);

        // Fetch family members' information for display
        if (data.familyMembers && data.familyMembers.length > 0) {
          const membersMap = new Map();
          for (const memberId of data.familyMembers) {
            try {
              const memberDoc = await getDoc(doc(db, 'parents', memberId));
              if (memberDoc.exists()) {
                const memberData = memberDoc.data();
                membersMap.set(memberId, {
                  id: memberId,
                  email: memberData.email,
                  name: memberData.email.split('@')[0] // Use email prefix as display name
                });
              }
            } catch (error) {
              console.error(`Error fetching family member ${memberId}:`, error);
            }
          }
          setFamilyMembers(membersMap);
          
          // Auto-sync family children using smart family detection
          const completeFamilyMembers = await smartFamilySync(data);
          
          // Set up children listener based on family sync
          const allFamilyChildren = await getAllFamilyChildren(completeFamilyMembers);
          if (allFamilyChildren.length > 0) {
            childrenListenerRef.current = setupChildrenListener(allFamilyChildren.map(child => child.id));
          }
        }
      } else {
        console.log('No parent document found, creating one...');
        // Create a basic parent document if it doesn't exist
        const newParentData = {
          email: user.email,
          familyName: 'My Family',
          children: [],
          shareCode: generateShareCode(),
          createdAt: new Date(),
          familyId: user.uid,
          familyMembers: [user.uid]
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
      // Get chores created by any family member
      const familyMembers = parentData?.familyMembers || [user.uid];
      
      const q = query(
        collection(db, 'chores'),
        where('parentId', 'in', familyMembers)
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
        console.log('Family chores updated:', choresData.length, 'chores');
      }, (error) => {
        console.error('Error setting up chores listener:', error);
        // Fallback to just current user's chores if the IN query fails
        const fallbackQ = query(
          collection(db, 'chores'),
          where('parentId', '==', user.uid)
        );
        
        const fallbackUnsubscribe = onSnapshot(fallbackQ, (snapshot) => {
          const choresData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          choresData.sort((a, b) => {
            const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bDate - aDate;
          });
          
          setChores(choresData);
          console.log('Parent chores updated (fallback):', choresData.length, 'chores');
        });
        
        return () => fallbackUnsubscribe();
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error creating chores query:', error);
      toast.error(`Failed to set up chores listener: ${error.message}`);
    }
  };

  const generateChildToken = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const ensureChildrenHaveTokens = async (childrenData) => {
    try {
      console.log('ensureChildrenHaveTokens called with:', childrenData.length, 'children');
      const updatesNeeded = childrenData.filter(child => !child.token);
      
      console.log('Children without tokens:', updatesNeeded.length);
      
      if (updatesNeeded.length > 0) {
        console.log(`Adding tokens to ${updatesNeeded.length} children without tokens`);
        
        for (const child of updatesNeeded) {
          const childRef = doc(db, 'children', child.id);
          const token = generateChildToken();
          console.log(`Adding token ${token} to child ${child.firstName} (${child.id})`);
          await updateDoc(childRef, { token });
          console.log(`Successfully added token ${token} to child ${child.firstName}`);
        }
        
        toast.success(`Added tokens to ${updatesNeeded.length} children`);
      } else {
        console.log('All children already have tokens');
      }
    } catch (error) {
      console.error('Error ensuring children have tokens:', error);
      toast.error('Failed to add tokens to some children');
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
        
        // Ensure all children have tokens
        ensureChildrenHaveTokens(childrenData);
        
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
      const choreDoc = await getDoc(choreRef);
      const choreData = choreDoc.data();

      if (choreData) {
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
      }

      await updateDoc(choreRef, {
        status: 'awaiting_goal_selection',
        approvedAt: new Date(),
        approvedBy: user.uid
      });

      toast.success('Chore approved! Child can now choose which goal to apply the reward to 🎯');
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

  const getParentName = (parentId) => {
    if (parentId === user.uid) return 'You';
    const member = familyMembers.get(parentId);
    return member ? member.name : 'Unknown Parent';
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard...</div>;
  }

  const pendingChores = chores.filter(chore => chore.status === 'pending_approval');
  const activeChores = chores.filter(chore => chore.status === 'assigned' || chore.status === 'pending_approval');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <div className="bg-white shadow-lg relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 
                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => setActiveTab('dashboard')}
                title="Click to go back to dashboard"
              >
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
              {/* Hamburger Menu Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors text-sm flex items-center justify-center border-2 border-blue-500 shadow-lg"
                >
                  {showMenu ? (
                    <div className="text-white text-lg font-bold">✕</div>
                  ) : (
                    <div className="text-white text-lg font-bold">☰</div>
                  )}
                </button>
                
                {/* Hamburger Menu Dropdown */}
                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 min-w-48">
                    {[
                      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                      { id: 'children', label: 'Children', icon: '👶' },
                      { id: 'chores', label: 'Chores', icon: '🧹' },
                      { id: 'goals', label: 'Goals', icon: '🎯' },
                      { id: 'share', label: 'Share', icon: '📤' },
                      { id: 'settings', label: 'Settings', icon: '⚙️' },
                      // Debug tab only visible to admin
                      ...(user.email === 'coreynadeau1@gmail.com' ? [{ id: 'debug', label: 'Debug', icon: '🔧' }] : []),
                    ].map(tab => (
                      <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 ${
                    activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
              <hr className="my-2 border-gray-200" />
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left hover:bg-red-50 transition-colors flex items-center space-x-3 text-red-600"
              >
                <span className="text-lg">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        ></div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-3">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div 
                onClick={() => setActiveTab('children')}
                className="bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:bg-blue-50 border-2 border-transparent hover:border-blue-200"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">👶</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-gray-900">{children.length}</div>
                    <div className="text-gray-600 text-sm">Children</div>
                  </div>
                </div>
              </div>
              <div 
                onClick={() => setActiveTab('chores')}
                className="bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:bg-green-50 border-2 border-transparent hover:border-green-200"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">🧹</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-gray-900">{activeChores.length}</div>
                    <div className="text-gray-600 text-sm">Total Chores</div>
                  </div>
                </div>
              </div>
              <div 
                onClick={() => setActiveTab('chores')}
                className="bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:bg-orange-50 border-2 border-transparent hover:border-orange-200"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="text-3xl">⏳</div>
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl font-bold text-orange-600">{pendingChores.length}</div>
                    <div className="text-gray-600 text-sm">Pending Approval</div>
                  </div>
                </div>
              </div>
              <div 
                onClick={() => setActiveTab('goals')}
                className="bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:bg-green-50 border-2 border-transparent hover:border-green-200"
              >
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
                          <p className="text-xs text-blue-600">
                            👨‍👩‍👧‍👦 Set by: {getParentName(chore.parentId)}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => approveChore(chore.id, chore.childId)}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => rejectChore(chore.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm transition-colors"
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
            familyMembers={familyMembers}
          />
        )}

        {activeTab === 'chores' && (
          <ChoreManagement 
            parentId={user.uid} 
            children={children} 
            chores={chores}
            familyMembers={familyMembers}
            getParentName={getParentName}
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
            familyMembers={familyMembers}
          />
        )}

        {activeTab === 'settings' && (
          <Settings user={user} />
        )}

        {activeTab === 'debug' && (
          <FamilyDebug />
        )}
      </div>
    </div>
  );
}

export default ParentDashboard;
