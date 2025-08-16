import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

function TestToken() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testTokenQuery();
  }, []);

  const testTokenQuery = async () => {
    try {
      const token = 'NJMHVGAA';
      console.log('Testing query for token:', token);
      
      const childrenRef = collection(db, 'children');
      const q = query(childrenRef, where('token', '==', token));
      
      const querySnapshot = await getDocs(q);
      console.log('Query snapshot size:', querySnapshot.size);
      
      if (!querySnapshot.empty) {
        const childDoc = querySnapshot.docs[0];
        const childData = { id: childDoc.id, ...childDoc.data() };
        console.log('Found child:', childData);
        setResult({ success: true, child: childData });
      } else {
        console.log('No child found with token:', token);
        setResult({ success: false, message: 'No child found' });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in token query:', error);
      setResult({ success: false, error: error.message });
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Testing token query...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Test Token Query: NJMHVGAA</h1>
      
      {result?.success ? (
        <div className="bg-green-100 p-4 rounded">
          <h2 className="font-bold text-green-800">✅ Child Found!</h2>
          <p><strong>Name:</strong> {result.child.firstName}</p>
          <p><strong>ID:</strong> {result.child.id}</p>
          <p><strong>Token:</strong> {result.child.token}</p>
          <p><strong>Parent ID:</strong> {result.child.parentId}</p>
        </div>
      ) : (
        <div className="bg-red-100 p-4 rounded">
          <h2 className="font-bold text-red-800">❌ Child Not Found</h2>
          <p>{result?.message || result?.error}</p>
        </div>
      )}
      
      <div className="mt-4">
        <button 
          onClick={testTokenQuery}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Test Query Again
        </button>
      </div>
    </div>
  );
}

export default TestToken;
