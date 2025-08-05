import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Components
import Login from './components/Login';
import ParentDashboard from './components/ParentDashboard';
import ChildDashboard from './components/ChildDashboard';
import Loading from './components/Loading';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState(null); // 'parent' or 'child'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Set userType to parent for authenticated users
        setUserType('parent');
      } else {
        setUserType(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 font-kid">
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={!user ? <Login setUserType={setUserType} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/parent" 
            element={user ? <ParentDashboard user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/child/:childToken" 
            element={<ChildDashboard />} 
          />
          <Route 
            path="/" 
            element={
              user ? <Navigate to="/parent" /> : <Navigate to="/login" />
            } 
          />
        </Routes>
      </Router>
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'font-kid',
          duration: 4000,
          style: {
            background: '#22c55e',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '16px',
          },
        }}
      />
    </div>
  );
}

export default App;
