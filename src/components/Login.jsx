import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

function Login({ setUserType }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isJoiningFamily, setIsJoiningFamily] = useState(false);
  const [isChildAccess, setIsChildAccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [childCode, setChildCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check for pending family code on component mount
  useEffect(() => {
    const pendingCode = sessionStorage.getItem('pendingFamilyCode');
    if (pendingCode) {
      setIsSignUp(true);
      setIsJoiningFamily(true);
      setFamilyCode(pendingCode);
      // Clear the pending code
      sessionStorage.removeItem('pendingFamilyCode');
      toast.success(`Ready to join family with code: ${pendingCode}! 🎉`, {
        duration: 4000,
      });
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isChildAccess) {
        // Handle child access
        await handleChildAccess();
        return;
      }

      let userCredential;
      
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        if (isJoiningFamily && familyCode) {
          // Join existing family
          await joinExistingFamily(userCredential.user.uid, familyCode);
        } else {
          // Create new family
          await createNewFamily(userCredential.user.uid);
        }
        
        toast.success(isJoiningFamily ? 'Welcome to the family! 🎉' : 'Welcome to ChoreTracker! 🎉');
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

  const handleChildAccess = async () => {
    if (!childCode || childCode.length < 6) {
      throw new Error('Please enter a valid child access code.');
    }

    // Verify child code exists
    const childrenQuery = query(
      collection(db, 'children'),
      where('token', '==', childCode.toUpperCase())
    );
    
    const childSnapshot = await getDocs(childrenQuery);
    
    if (childSnapshot.empty) {
      throw new Error('Child access code not found. Please check the code and try again.');
    }

    const childDoc = childSnapshot.docs[0];
    const childData = childDoc.data();
    
    toast.success(`Welcome ${childData.firstName}! 🎉`);
    
    // Navigate to child dashboard
    navigate(`/child/${childCode.toUpperCase()}`);
  };

  const createNewFamily = async (userId) => {
    await setDoc(doc(db, 'parents', userId), {
      email,
      familyName,
      createdAt: new Date(),
      children: [],
      shareCode: generateShareCode(),
      familyId: userId, // The first parent's ID becomes the family ID
      familyMembers: [userId] // Array of parent IDs in this family
    });
  };

  const joinExistingFamily = async (userId, shareCode) => {
    if (!shareCode || shareCode.length !== 6) {
      throw new Error('Please enter a valid 6-character family code.');
    }

    // Find the family with this share code
    const q = query(collection(db, 'parents'), where('shareCode', '==', shareCode.toUpperCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('Family code not found. Please check the code and try again.');
    }

    // Get the first family found (should only be one)
    const familyDoc = querySnapshot.docs[0];
    const familyData = familyDoc.data();
    const originalParentId = familyDoc.id;

    // Check if user is already in this family
    if (familyData.familyMembers && familyData.familyMembers.includes(userId)) {
      throw new Error('You are already a member of this family.');
    }

    // Create new parent document for joining parent
    await setDoc(doc(db, 'parents', userId), {
      email,
      familyName: familyData.familyName,
      createdAt: new Date(),
      children: familyData.children || [], // Share the same children
      shareCode: familyData.shareCode, // Share the same code
      familyId: familyData.familyId || originalParentId,
      familyMembers: [...(familyData.familyMembers || [originalParentId]), userId]
    });

    // Update the original family document to include the new parent
    await updateDoc(doc(db, 'parents', originalParentId), {
      familyMembers: arrayUnion(userId)
    });

    // Update all other family members with the new member
    const familyMembers = familyData.familyMembers || [originalParentId];
    for (const memberId of familyMembers) {
      if (memberId !== originalParentId && memberId !== userId) {
        try {
          await updateDoc(doc(db, 'parents', memberId), {
            familyMembers: arrayUnion(userId)
          });
        } catch (error) {
          console.warn(`Could not update family member ${memberId}:`, error);
        }
      }
    }
  };

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-400 via-blue-500 to-green-400">
      <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-2xl border-4 border-blue-200 transform hover:scale-105 transition-transform duration-300">
        <div className="text-center mb-12">
          <div className="text-massive mb-8 animate-bounce">{isChildAccess ? '🧒' : '🎯'}</div>
          <h1 className="text-super font-fun bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent mb-6 tracking-wide">
            ChoreTracker
          </h1>
          <p className="text-4xl text-gray-700 font-playful font-bold mb-6 tracking-wide">
            {isChildAccess ? 'Welcome to your chore portal! 🌟' : 'Make chores fun and rewarding! 🌟'}
          </p>
          <div className="flex justify-center space-x-6 mt-8 mb-10">
            <span className="text-6xl animate-pulse">⭐</span>
            <span className="text-6xl animate-pulse delay-150">{isChildAccess ? '🧒' : '🎉'}</span>
            <span className="text-6xl animate-pulse delay-300">🏆</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-10">
          {/* Access Type Selection */}
          <div className="text-center">
            <div className="flex justify-center space-x-2 mb-6 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsChildAccess(false);
                  setIsSignUp(false);
                  setIsJoiningFamily(false);
                }}
                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  !isChildAccess && !isSignUp 
                    ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                👨‍👩‍👧‍👦 Parent Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChildAccess(false);
                  setIsSignUp(true);
                  setIsJoiningFamily(false);
                }}
                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  !isChildAccess && isSignUp && !isJoiningFamily 
                    ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ✨ Create Family
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChildAccess(false);
                  setIsSignUp(true);
                  setIsJoiningFamily(true);
                }}
                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  !isChildAccess && isJoiningFamily 
                    ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                👥 Join Family
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChildAccess(true);
                  setIsSignUp(false);
                  setIsJoiningFamily(false);
                }}
                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  isChildAccess 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🧒 Kid's Portal
              </button>
            </div>
          </div>

          {isChildAccess ? (
            /* Child Access Form */
            <div className="space-y-8">
              <div className="text-center">
                <div className="text-6xl mb-4">🧒</div>
                <h2 className="text-3xl font-bold text-purple-600 mb-2">Kid's Portal</h2>
                <p className="text-gray-600 text-lg">Enter your special code to access your chores!</p>
              </div>
              
              <div>
                <label className="block text-2xl font-fun text-purple-700 mb-4 tracking-wide">
                  🎯 Your Access Code
                </label>
                <input
                  type="text"
                  value={childCode}
                  onChange={(e) => setChildCode(e.target.value.toUpperCase())}
                  className="w-full p-4 border-3 border-purple-200 rounded-2xl focus:border-purple-500 focus:outline-none transition-all duration-200 text-lg font-playful shadow-lg hover:shadow-xl bg-purple-50 text-center font-bold tracking-widest"
                  placeholder="ABC123XY"
                  maxLength="10"
                  style={{ textTransform: 'uppercase' }}
                  required
                />
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Ask your parent for your special access code
                </p>
              </div>
            </div>
          ) : (
            /* Parent Access Forms */
            <>
              {isSignUp && (
                <>
                  {/* Join Family Toggle */}
                  {/* <div className="text-center">
                    <div className="flex justify-center space-x-4 mb-6">
                      <button
                        type="button"
                        onClick={() => setIsJoiningFamily(false)}
                        className={`px-6 py-3 rounded-xl font-bold text-lg transition-all duration-200 ${
                          !isJoiningFamily 
                            ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        🆕 Create New Family
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsJoiningFamily(true)}
                        className={`px-6 py-3 rounded-xl font-bold text-lg transition-all duration-200 ${
                          isJoiningFamily 
                            ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        👥 Join Existing Family
                      </button>
                    </div>
                  </div> */}

                  {isJoiningFamily ? (
                    <div>
                      <label className="block text-2xl font-fun text-blue-700 mb-4 tracking-wide">
                        🔑 Family Code
                      </label>
                      <input
                        type="text"
                        value={familyCode}
                        onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                        className="w-full p-4 border-3 border-blue-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-all duration-200 text-lg font-playful shadow-lg hover:shadow-xl bg-blue-50 text-center font-bold tracking-widest"
                        placeholder="ABC123"
                        maxLength="6"
                        style={{ textTransform: 'uppercase' }}
                        required
                      />
                      <p className="text-sm text-gray-600 mt-2 text-center">
                        Enter the 6-character code shared by another parent in your family
                      </p>
                    </div>
                  ) : (
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
                </>
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
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-bold py-8 px-8 rounded-3xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-4xl font-fun shadow-2xl hover:shadow-3xl ${
              isChildAccess 
                ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700 text-white'
                : 'bg-gradient-to-r from-blue-500 via-green-500 to-blue-600 hover:from-blue-600 hover:via-green-600 hover:to-blue-700 text-white'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white"></div>
                <span className="text-3xl">Loading... 🔄</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-4">
                <span className="text-5xl">
                  {isChildAccess ? '🧒' : (isSignUp ? (isJoiningFamily ? '👥' : '🎉') : '🚀')}
                </span>
                {isChildAccess 
                  ? 'Enter Kid\'s Portal!' 
                  : (isSignUp ? (isJoiningFamily ? 'Join Family!' : 'Create Family Account!') : 'Sign In & Start!')
                }
                <span className="text-5xl">
                  {isChildAccess ? '🎯' : (isSignUp ? (isJoiningFamily ? '🤝' : '✨') : '🎯')}
                </span>
              </span>
            )}
          </button>
        </form>

        {!isChildAccess && (
          <div className="mt-12 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-700 font-bold text-3xl font-playful hover:scale-105 transform transition-all duration-200 tracking-wide"
            >
              {isSignUp ? '👋 Already have an account? Sign In!' : '✨ New family? Create Account!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
