import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

function FamilyDebug() {
  const [user, setUser] = useState(null);
  const [debugData, setDebugData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchDebugData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = {};
      
      // Get current user's parent document
      const parentDoc = await getDoc(doc(db, 'parents', user.uid));
      if (parentDoc.exists()) {
        data.parentData = { id: parentDoc.id, ...parentDoc.data() };
        
        // Get all family members
        const familyMembers = data.parentData.familyMembers || [user.uid];
        data.familyMembersData = [];
        
        for (const memberId of familyMembers) {
          const memberDoc = await getDoc(doc(db, 'parents', memberId));
          if (memberDoc.exists()) {
            data.familyMembersData.push({ id: memberDoc.id, ...memberDoc.data() });
          }
        }
        
        // Get all children referenced by this family
        const childrenIds = data.parentData.children || [];
        data.childrenData = [];
        
        for (const childId of childrenIds) {
          const childDoc = await getDoc(doc(db, 'children', childId));
          if (childDoc.exists()) {
            data.childrenData.push({ id: childDoc.id, ...childDoc.data() });
          } else {
            data.childrenData.push({ id: childId, error: 'Document not found' });
          }
        }
        
        // Get all children in the entire database to see if any are orphaned
        const allChildrenSnapshot = await getDocs(collection(db, 'children'));
        data.allChildren = allChildrenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter for children that belong to any family member
        data.familyChildren = data.allChildren.filter(child => 
          familyMembers.includes(child.parentId)
        );
        
      } else {
        data.error = 'Parent document not found';
      }
      
      setDebugData(data);
    } catch (error) {
      console.error('Debug fetch error:', error);
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDebugData();
    }
  }, [user]);

  const fixChildrenReferences = async () => {
    if (!debugData.parentData || !debugData.familyChildren) return;
    
    try {
      // Get all child IDs that should be in the family
      const correctChildIds = debugData.familyChildren.map(child => child.id);
      
      // Get all unique parent IDs from the family children (this gives us the complete family member list)
      const allParentIds = [...new Set(debugData.familyChildren.map(child => child.parentId))];
      
      // Add current user to the list if not already there
      if (!allParentIds.includes(user.uid)) {
        allParentIds.push(user.uid);
      }
      
      console.log('Complete family member list based on children:', allParentIds);
      console.log('Correct child IDs:', correctChildIds);
      
      // Update current user's document with complete family info
      await updateDoc(doc(db, 'parents', user.uid), {
        children: correctChildIds,
        familyMembers: allParentIds
      });
      
      console.log('Updated current user\'s children and family members');
      
      // Try to update other family members if possible (this might fail due to security rules)
      for (const parentId of allParentIds) {
        if (parentId !== user.uid) {
          try {
            await updateDoc(doc(db, 'parents', parentId), {
              children: correctChildIds,
              familyMembers: allParentIds
            });
            console.log(`Updated family member ${parentId}`);
          } catch (error) {
            console.log(`Could not update family member ${parentId} (they need to refresh):`, error.message);
          }
        }
      }
      
      alert(`✅ Fixed family sync!\n\n🔧 Updated your document with:\n- ${correctChildIds.length} children\n- ${allParentIds.length} family members\n\n💡 Other family members should refresh their browsers to see the updates.`);
      
      fetchDebugData(); // Refresh data
    } catch (error) {
      console.error('Error fixing children references:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (!user) {
    return <div className="p-6">Please log in to see debug info</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Family Debug Information</h2>
        <div className="space-x-2">
          <button
            onClick={fetchDebugData}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
          {debugData.familyChildren && debugData.parentData && (
            <button
              onClick={fixChildrenReferences}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Fix Children References
            </button>
          )}
        </div>
      </div>

      {debugData.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {debugData.error}
        </div>
      )}

      {debugData.parentData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current User's Parent Data */}
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-bold mb-3">Your Parent Document</h3>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div><strong>ID:</strong> {debugData.parentData.id}</div>
              <div><strong>Email:</strong> {debugData.parentData.email}</div>
              <div><strong>Family Name:</strong> {debugData.parentData.familyName}</div>
              <div><strong>Share Code:</strong> {debugData.parentData.shareCode}</div>
              <div><strong>Children Array:</strong> [{debugData.parentData.children?.join(', ') || 'empty'}]</div>
              <div><strong>Family Members:</strong> [{debugData.parentData.familyMembers?.join(', ') || 'none'}]</div>
            </div>
          </div>

          {/* Family Members */}
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-bold mb-3">All Family Members</h3>
            <div className="space-y-2">
              {debugData.familyMembersData?.map(member => (
                <div key={member.id} className="bg-gray-50 p-3 rounded text-sm">
                  <div><strong>ID:</strong> {member.id}</div>
                  <div><strong>Email:</strong> {member.email}</div>
                  <div><strong>Children:</strong> [{member.children?.join(', ') || 'empty'}]</div>
                </div>
              )) || <div>No family members found</div>}
            </div>
          </div>

          {/* Referenced Children */}
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-bold mb-3">Referenced Children</h3>
            <div className="space-y-2">
              {debugData.childrenData?.map(child => (
                <div key={child.id} className="bg-gray-50 p-3 rounded text-sm">
                  {child.error ? (
                    <div className="text-red-600">
                      <strong>ID:</strong> {child.id}<br />
                      <strong>Error:</strong> {child.error}
                    </div>
                  ) : (
                    <>
                      <div><strong>ID:</strong> {child.id}</div>
                      <div><strong>Name:</strong> {child.firstName}</div>
                      <div><strong>Parent ID:</strong> {child.parentId}</div>
                      <div><strong>Token:</strong> {child.token}</div>
                    </>
                  )}
                </div>
              )) || <div>No children referenced</div>}
            </div>
          </div>

          {/* All Family Children */}
          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-bold mb-3">All Family Children (by parentId)</h3>
            <div className="space-y-2">
              {debugData.familyChildren?.map(child => (
                <div key={child.id} className="bg-blue-50 p-3 rounded text-sm border border-blue-200">
                  <div><strong>ID:</strong> {child.id}</div>
                  <div><strong>Name:</strong> {child.firstName}</div>
                  <div><strong>Parent ID:</strong> {child.parentId}</div>
                  <div><strong>Token:</strong> {child.token}</div>
                  <div><strong>Total Earnings:</strong> ${child.totalEarnings || 0}</div>
                </div>
              )) || <div>No family children found</div>}
            </div>
          </div>
        </div>
      )}

      {/* Data Discrepancy Alert */}
      {debugData.parentData && debugData.familyChildren && (
        <div className="bg-yellow-100 border border-yellow-400 p-4 rounded">
          <h3 className="font-bold mb-2">Data Analysis</h3>
          <div className="text-sm space-y-1">
            <div>Children in parent document: {debugData.parentData.children?.length || 0}</div>
            <div>Children found by parentId: {debugData.familyChildren.length}</div>
            {(debugData.parentData.children?.length || 0) !== debugData.familyChildren.length && (
              <div className="text-red-600 font-bold">
                ⚠️ MISMATCH: Parent document and actual children don't match!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FamilyDebug;
