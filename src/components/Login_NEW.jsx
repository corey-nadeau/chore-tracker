import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import toast from 'react-hot-toast';

function Login({ setUserType }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userCredential;
      
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create parent profile
        await setDoc(doc(db, 'parents', userCredential.user.uid), {
          email,
          familyName,
          createdAt: new Date(),
          children: [],
          shareCode: generateShareCode()
        });
        
        toast.success('Welcome to ChoreTracker! 🎉');
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Check if parent exists
        const parentDoc = await getDoc(doc(db, 'parents', userCredential.user.uid));
        if (parentDoc.exists()) {
          toast.success('Welcome back! 👋');
        } else {
          toast.error('Parent account not found');
          return;
        }
      }
      
      setUserType('parent');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-100 via-green-50 to-blue-50">
      <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-2xl border-4 border-blue-200 transform hover:scale-105 transition-transform duration-300">
        <div className="text-center mb-12">
          <div className="text-9xl mb-8 animate-bounce">🎯</div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-6 font-kid">
            ChoreTracker
          </h1>
          <p className="text-2xl text-gray-700 font-kid font-bold mb-6">Make chores fun and rewarding! 🌟</p>
          <div className="flex justify-center space-x-4 mt-6 mb-8">
            <span className="text-4xl animate-pulse">⭐</span>
            <span className="text-4xl animate-pulse delay-150">🎉</span>
            <span className="text-4xl animate-pulse delay-300">🏆</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-8">
          {isSignUp && (
            <div>
              <label className="block text-xl font-bold text-blue-700 mb-4 font-kid">
                🏠 Family Name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full p-5 border-4 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-xl font-medium shadow-lg hover:shadow-xl bg-blue-50"
                placeholder="The Smith Family"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xl font-bold text-blue-700 mb-4 font-kid">
              📧 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-5 border-4 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-xl font-medium shadow-lg hover:shadow-xl bg-blue-50"
              placeholder="parent@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xl font-bold text-blue-700 mb-4 font-kid">
              🔒 Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-5 border-4 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-xl font-medium shadow-lg hover:shadow-xl bg-blue-50"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 via-green-500 to-blue-600 text-white font-bold py-6 px-8 rounded-2xl hover:from-blue-600 hover:via-green-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-2xl font-kid shadow-2xl"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white mr-4"></div>
                <span className="text-xl">Loading... 🔄</span>
              </div>
            ) : (
              <span className="flex items-center justify-center">
                {isSignUp ? '🎉 Create Family Account!' : '🚀 Sign In & Start!'}
              </span>
            )}
          </button>
        </form>

        <div className="mt-10 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-700 font-bold text-xl font-kid hover:scale-105 transform transition-all duration-200"
          >
            {isSignUp ? '👋 Already have an account? Sign In!' : '✨ New family? Create Account!'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
