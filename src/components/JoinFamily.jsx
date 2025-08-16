import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function JoinFamily() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const [familyInfo, setFamilyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const validateFamilyCode = async () => {
      try {
        if (!shareCode) {
          setError('No family code provided');
          setLoading(false);
          return;
        }

        console.log('Looking for family code:', shareCode.toUpperCase());
        console.log('Database instance:', db);

        // Fetch all parents and find matching shareCode in JavaScript
        // (bypassing Firestore query due to missing index)
        const allParentsQuery = await getDocs(collection(db, 'parents'));
        console.log('All parents in database:', allParentsQuery.size, 'documents');
        
        let matchingFamily = null;
        const searchCode = shareCode.toUpperCase().trim();
        
        allParentsQuery.docs.forEach(doc => {
          const data = doc.data();
          console.log('Parent:', doc.id, 'shareCode:', data.shareCode, 'familyName:', data.familyName);
          
          if (data.shareCode) {
            const dbCode = data.shareCode.toString().toUpperCase().trim();
            console.log('Comparing:', `"${dbCode}"`, 'with', `"${searchCode}"`);
            
            if (dbCode === searchCode) {
              matchingFamily = { id: doc.id, ...data };
              console.log('✅ Found matching family!', matchingFamily);
            }
          }
        });
        
        if (!matchingFamily) {
          console.log('❌ No matching family found');
          setError(`Family code "${shareCode.toUpperCase()}" not found`);
          setLoading(false);
          return;
        }

        // Use the matching family data
        console.log('✅ Found family, setting familyInfo:', matchingFamily);
        
        setFamilyInfo({
          familyName: matchingFamily.familyName,
          shareCode: matchingFamily.shareCode,
          memberCount: matchingFamily.familyMembers ? matchingFamily.familyMembers.length : 1
        });
        
        console.log('✅ familyInfo set successfully');
      } catch (error) {
        console.error('Error validating family code:', error);
        setError(`Error validating family code: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    validateFamilyCode();
  }, [shareCode]);

  const handleJoinFamily = () => {
    // Store the share code and redirect to signup
    sessionStorage.setItem('pendingFamilyCode', shareCode.toUpperCase());
    navigate('/login');
    toast.success('Ready to join! Please create your account to join this family.', {
      duration: 6000,
    });
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-400 via-blue-500 to-green-400">
        <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-2xl border-4 border-blue-200 text-center">
          <div className="text-6xl mb-6 animate-bounce">🔍</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Validating Family Code...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-400 via-blue-500 to-green-400">
        <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-2xl border-4 border-red-200 text-center">
          <div className="text-6xl mb-6">❌</div>
          <h1 className="text-4xl font-bold text-red-600 mb-4">Family Code Not Found</h1>
          <p className="text-xl text-gray-700 mb-8">
            The family code "{shareCode?.toUpperCase()}" could not be found. Please check the code and try again.
          </p>
          <button
            onClick={handleGoToLogin}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 text-xl"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-400 via-blue-500 to-green-400">
      <div className="bg-white rounded-3xl shadow-2xl p-12 w-full max-w-2xl border-4 border-blue-200">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce">👨‍👩‍👧‍👦</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Join Family</h1>
          <p className="text-xl text-gray-600">You've been invited to join a family!</p>
        </div>

        {familyInfo && (
          <>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 mb-8 border-2 border-green-200">
              <h2 className="text-2xl font-bold text-center text-green-800 mb-4">
                🏠 {familyInfo.familyName}
              </h2>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-3xl mb-2">🔑</div>
                  <div className="text-sm text-gray-600">Family Code</div>
                  <div className="text-xl font-bold text-blue-600">{familyInfo.shareCode}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-3xl mb-2">👥</div>
                  <div className="text-sm text-gray-600">Current Members</div>
                  <div className="text-xl font-bold text-green-600">{familyInfo.memberCount}</div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-6">
              <button
                onClick={handleJoinFamily}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold py-4 px-8 rounded-2xl hover:from-green-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-300 text-xl shadow-lg"
              >
                <span className="flex items-center justify-center gap-3">
                  <span className="text-3xl">🎉</span>
                  Join This Family!
                  <span className="text-3xl">✨</span>
                </span>
              </button>

              <div className="text-gray-600 text-sm">
                You'll need to create an account or sign in to join this family
              </div>

              <button
                onClick={handleGoToLogin}
                className="text-blue-600 hover:text-blue-700 font-bold text-lg hover:scale-105 transform transition-all duration-200"
              >
                Already have an account? Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default JoinFamily;
