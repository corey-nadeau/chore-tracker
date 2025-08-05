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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-100 via-secondary-50 to-primary-50">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg border-4 border-gradient-to-r from-primary-300 to-secondary-300">
        <div className="text-center mb-10">
          <div className="text-8xl mb-6 animate-bounce-slow">�</div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-4 font-kid">
            ChoreTracker
          </h1>
          <p className="text-xl text-gray-700 font-kid font-medium">Make chores fun and rewarding! 🌟</p>
          <div className="flex justify-center space-x-2 mt-4">
            <span className="text-2xl animate-pulse">⭐</span>
            <span className="text-2xl animate-pulse delay-100">🎉</span>
            <span className="text-2xl animate-pulse delay-200">🏆</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-8">
          {isSignUp && (
            <div>
              <label className="block text-lg font-bold text-primary-700 mb-3 font-kid">
                🏠 Family Name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full p-4 border-3 border-primary-200 rounded-2xl focus:border-primary-500 focus:outline-none transition-all duration-200 text-lg font-medium shadow-lg"
                placeholder="The Smith Family"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-lg font-bold text-primary-700 mb-3 font-kid">
              📧 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 border-3 border-primary-200 rounded-2xl focus:border-primary-500 focus:outline-none transition-all duration-200 text-lg font-medium shadow-lg"
              placeholder="parent@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-primary-700 mb-3 font-kid">
              🔒 Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border-3 border-primary-200 rounded-2xl focus:border-primary-500 focus:outline-none transition-all duration-200 text-lg font-medium shadow-lg"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white font-bold py-5 px-8 rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-kid shadow-2xl"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-3 border-white mr-3"></div>
                <span className="text-lg">Loading... 🔄</span>
              </div>
            ) : (
              <span className="flex items-center justify-center">
                {isSignUp ? '🎉 Create Family Account!' : '🚀 Sign In & Start!'}
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary-600 hover:text-primary-700 font-bold text-lg font-kid hover:scale-105 transform transition-all duration-200"
          >
            {isSignUp ? '👋 Already have an account? Sign In!' : '✨ New family? Create Account!'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
