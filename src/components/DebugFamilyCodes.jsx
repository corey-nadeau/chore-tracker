import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function DebugFamilyCodes() {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const fetchParents = async () => {
    try {
      console.log('Attempting to fetch parents from Firebase...');
      console.log('Database instance:', db);
      
      const querySnapshot = await getDocs(collection(db, 'parents'));
      console.log('Query completed. Total documents:', querySnapshot.size);
      
      const parentData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`Parent document ${doc.id}:`, data);
        return {
          id: doc.id,
          ...data
        };
      });
      
      setParents(parentData);
      console.log('All parent documents:', parentData);
      
      if (parentData.length === 0) {
        console.warn('No parent documents found in the database!');
        toast.error('No parent documents found. Have you created an account yet?');
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        name: error.name
      });
      toast.error(`Database error: ${error.message}`);
    }
  };

  const fixMissingShareCodes = async () => {
    setFixing(true);
    try {
      const parentsWithoutCodes = parents.filter(parent => !parent.shareCode);
      console.log('Parents without share codes:', parentsWithoutCodes.length);
      
      for (const parent of parentsWithoutCodes) {
        const shareCode = generateShareCode();
        const updates = {
          shareCode,
          familyId: parent.familyId || parent.id,
          familyMembers: parent.familyMembers || [parent.id]
        };
        
        console.log(`Updating parent ${parent.id} with:`, updates);
        await updateDoc(doc(db, 'parents', parent.id), updates);
      }
      
      toast.success(`Fixed ${parentsWithoutCodes.length} parent documents!`);
      await fetchParents(); // Refresh the data
    } catch (error) {
      console.error('Error fixing share codes:', error);
      toast.error('Failed to fix share codes');
    } finally {
      setFixing(false);
    }
  };

  const regenerateShareCode = async (parentId, currentCode) => {
    if (!window.confirm(`Are you sure you want to generate a new family code? This will replace "${currentCode}" and any existing family links will stop working.`)) {
      return;
    }

    try {
      const newShareCode = generateShareCode();
      console.log(`Regenerating share code for parent ${parentId}: ${currentCode} → ${newShareCode}`);
      
      await updateDoc(doc(db, 'parents', parentId), {
        shareCode: newShareCode
      });
      
      toast.success(`New family code generated: ${newShareCode}`);
      await fetchParents(); // Refresh the data
    } catch (error) {
      console.error('Error regenerating share code:', error);
      toast.error('Failed to regenerate share code');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchParents();
      setLoading(false);
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading parent data...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Family Codes</h1>
      <p className="mb-4">Total parent documents: {parents.length}</p>
      
      {parents.length === 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-800 mb-2">🚨 No Parent Documents Found</h2>
          <p className="text-red-700 mb-4">
            There are no parent accounts in the database. This could mean:
          </p>
          <ul className="list-disc list-inside text-red-700 mb-4 space-y-1">
            <li>You haven't created a parent account yet</li>
            <li>There's a Firebase connection issue</li>
            <li>The database is empty</li>
          </ul>
          <div className="space-y-2">
            <button
              onClick={fetchParents}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors mr-2"
            >
              🔄 Refresh Data
            </button>
            <a 
              href="/login" 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-block"
            >
              🔐 Go to Login/Signup
            </a>
          </div>
        </div>
      ) : (
        <>
          {parents.some(parent => !parent.shareCode) && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h2 className="text-lg font-bold text-yellow-800 mb-2">⚠️ Missing Share Codes Detected</h2>
              <p className="text-yellow-700 mb-4">
                Some parent documents don't have share codes. This will cause family sharing to not work.
              </p>
              <button
                onClick={fixMissingShareCodes}
                disabled={fixing}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {fixing ? 'Fixing...' : '🔧 Fix Missing Share Codes'}
              </button>
            </div>
          )}
        </>
      )}
      
      <div className="space-y-4">
        {parents.map(parent => (
          <div key={parent.id} className="bg-white rounded-lg shadow-md p-4 border">
            <h3 className="font-bold text-lg">{parent.familyName || 'No Family Name'}</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <strong>ID:</strong> {parent.id}
              </div>
              <div>
                <strong>Email:</strong> {parent.email || 'No email'}
              </div>
              <div>
                <strong>Share Code:</strong> 
                <span className="font-mono bg-gray-100 px-2 py-1 rounded ml-2">
                  {parent.shareCode || 'NO CODE'}
                </span>
                {parent.shareCode && (
                  <button
                    onClick={() => regenerateShareCode(parent.id, parent.shareCode)}
                    className="ml-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 text-xs rounded transition-colors"
                    title="Generate new family code"
                  >
                    🔄 New Code
                  </button>
                )}
              </div>
              <div>
                <strong>Family ID:</strong> {parent.familyId || 'No family ID'}
              </div>
              <div>
                <strong>Family Members:</strong> {parent.familyMembers ? parent.familyMembers.length : 0}
              </div>
              <div>
                <strong>Children:</strong> {parent.children ? parent.children.length : 0}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {parent.shareCode && (
                <>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/join/${parent.shareCode}`;
                      navigator.clipboard.writeText(link);
                      toast.success('Family link copied!');
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-sm rounded transition-colors"
                  >
                    📋 Copy Family Link
                  </button>
                  <button
                    onClick={() => {
                      window.open(`${window.location.origin}/join/${parent.shareCode}`, '_blank');
                    }}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 text-sm rounded transition-colors"
                  >
                    🔗 Test Link
                  </button>
                </>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              <strong>Created:</strong> {parent.createdAt ? new Date(parent.createdAt.toDate()).toLocaleString() : 'No date'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DebugFamilyCodes;
