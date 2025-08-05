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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-400 via-blue-500 to-green-400">
      <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-2xl border-4 border-blue-200 transform hover:scale-105 transition-transform duration-300">
        <div className="text-center mb-12">
          <div className="text-massive mb-8 animate-bounce">🎯</div>
          <h1 className="text-super font-fun bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-6 tracking-wide">
            ChoreTracker
          </h1>
          <p className="text-4xl text-gray-700 font-playful font-bold mb-6 tracking-wide">Make chores fun and rewarding! 🌟</p>
          <div className="flex justify-center space-x-6 mt-8 mb-10">
            <span className="text-6xl animate-pulse">⭐</span>
            <span className="text-6xl animate-pulse delay-150">🎉</span>
            <span className="text-6xl animate-pulse delay-300">🏆</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-10">
          {isSignUp && (
            <div>
              <label className="block text-2xl font-fun text-blue-700 mb-4 tracking-wide">
                🏠 Family Name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full p-4 border-3 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-lg font-playful shadow-lg hover:shadow-xl bg-blue-50"
                placeholder="The Smith Family"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-2xl font-fun text-blue-700 mb-4 tracking-wide">
              📧 Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 border-3 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-lg font-playful shadow-lg hover:shadow-xl bg-blue-50"
              placeholder="parent@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-2xl font-fun text-blue-700 mb-4 tracking-wide">
              🔒 Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border-3 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-lg font-playful shadow-lg hover:shadow-xl bg-blue-50"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 via-green-500 to-blue-600 text-white font-bold py-8 px-8 rounded-3xl hover:from-blue-600 hover:via-green-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-4xl font-fun shadow-2xl hover:shadow-3xl"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white"></div>
                <span className="text-3xl">Loading... 🔄</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-4">
                <span className="text-5xl">{isSignUp ? '🎉' : '🚀'}</span>
                {isSignUp ? 'Create Family Account!' : 'Sign In & Start!'}
                <span className="text-5xl">{isSignUp ? '✨' : '🎯'}</span>
              </span>
            )}
          </button>
        </form>

        <div className="mt-12 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-700 font-bold text-3xl font-playful hover:scale-105 transform transition-all duration-200 tracking-wide"
          >
            {isSignUp ? '👋 Already have an account? Sign In!' : '✨ New family? Create Account!'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
