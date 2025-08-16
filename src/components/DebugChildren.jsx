import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

function DebugChildren() {
  const [childrenData, setChildrenData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllChildren();
  }, []);

  const loadAllChildren = async () => {
    try {
      const childrenRef = collection(db, 'children');
      const snapshot = await getDocs(childrenRef);
      
      const children = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('All children in database:', children);
      setChildrenData(children);
      setLoading(false);
    } catch (error) {
      console.error('Error loading children:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading children data...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Debug: All Children in Database</h1>
      
      <div className="space-y-4">
        {childrenData.map((child) => (
          <div key={child.id} className="border p-4 rounded">
            <h3 className="font-bold">{child.firstName || 'No Name'}</h3>
            <p><strong>ID:</strong> {child.id}</p>
            <p><strong>Token:</strong> {child.token || 'NO TOKEN'}</p>
            <p><strong>Parent ID:</strong> {child.parentId || 'NO PARENT ID'}</p>
            {child.token && (
              <p><strong>Child Link:</strong> 
                <a 
                  href={`/child/${child.token}`} 
                  className="text-blue-500 underline ml-2"
                  target="_blank"
                >
                  /child/{child.token}
                </a>
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600">Raw Data</summary>
              <pre className="bg-gray-100 p-2 mt-2 text-xs overflow-auto">
                {JSON.stringify(child, null, 2)}
              </pre>
            </details>
          </div>
        ))}
        
        {childrenData.length === 0 && (
          <div className="text-gray-500">No children found in database</div>
        )}
      </div>
    </div>
  );
}

export default DebugChildren;
