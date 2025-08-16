import { useState } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function ShareFamily({ shareCode, parentId, familyMembers = new Map() }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const copyShareCode = () => {
    navigator.clipboard.writeText(shareCode);
    toast.success('Share code copied! 📋');
  };

  const copyFamilyLink = () => {
    const link = `${window.location.origin}/join/${shareCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Family link copied! 📋');
  };

  const shareViaEmail = () => {
    const subject = 'Join our family on ChoreTracker!';
    const body = `Hi! I'd like to invite you to join our family on ChoreTracker. 

Use this link to join: ${window.location.origin}/join/${shareCode}

Or use share code: ${shareCode}

ChoreTracker makes managing chores and allowances fun and easy!`;
    
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    setEmail('');
  };

  const sendInvite = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      // In a real app, you'd send an email invitation here
      // For now, we'll just add to pending invites
      await updateDoc(doc(db, 'parents', parentId), {
        pendingInvites: arrayUnion({
          email,
          invitedAt: new Date(),
          status: 'pending'
        })
      });

      toast.success('Invitation sent! 📧');
      shareViaEmail();
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📤 Share Your Family</h2>
        <p className="text-gray-600">
          Invite other parents to help manage your family's chores and allowances.
        </p>
      </div>

      {/* Current Family Members */}
      {familyMembers && familyMembers.size > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
            👨‍👩‍👧‍👦 Family Members ({familyMembers.size})
          </h3>
          
          {familyMembers.size === 1 ? (
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-3xl mb-2">👋</div>
              <p className="text-blue-800 font-medium">You're the only family member so far!</p>
              <p className="text-blue-600 text-sm mt-1">
                Share your family code below to invite another parent to join.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {Array.from(familyMembers.values()).map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">👤</div>
                      <div>
                        <p className="font-medium text-green-900">{member.name}</p>
                        <p className="text-sm text-green-700">{member.email}</p>
                      </div>
                    </div>
                    <div className="text-green-600 text-sm font-medium">
                      {member.id === parentId ? 'You' : 'Family Member'}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-green-700 text-sm">
                  ✅ All family members can create chores and approve completed ones
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Share Code Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
          🔑 Your Family Share Code
        </h3>
        
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 text-center mb-6">
          <div className="text-4xl font-bold text-blue-600 mb-2 tracking-wider">
            {shareCode}
          </div>
          <p className="text-gray-600 text-sm">
            Other parents can use this code to join your family
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={copyShareCode}
            className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-xl font-medium transition-colors"
          >
            📋 Copy Share Code
          </button>
          
          <button
            onClick={copyFamilyLink}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-medium transition-colors"
          >
            🔗 Copy Family Link
          </button>
        </div>
      </div>

      {/* Email Invitation */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📧 Invite via Email
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="other-parent@example.com"
            />
          </div>
          
          <button
            onClick={sendInvite}
            disabled={loading || !email}
            className="w-full bg-gradient-to-r from-blue-500 to-green-500 text-white py-3 px-6 rounded-xl font-medium hover:from-blue-600 hover:to-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending...
              </div>
            ) : (
              '📧 Send Invitation'
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl p-4">
        <h3 className="text-base font-bold text-blue-900 mb-2">
          🤝 How Family Sharing Works
        </h3>
        
        <div className="space-y-2 text-blue-800 text-sm">
          <div className="flex items-start space-x-2">
            <div className="text-sm">1️⃣</div>
            <p>Share your family code or link with other parents</p>
          </div>
          
          <div className="flex items-start space-x-2">
            <div className="text-sm">2️⃣</div>
            <p>They can join using the code and create their own parent account</p>
          </div>
          
          <div className="flex items-start space-x-2">
            <div className="text-sm">3️⃣</div>
            <p>Both parents can manage the same children and approve chores</p>
          </div>
          
          <div className="flex items-start space-x-2">
            <div className="text-sm">4️⃣</div>
            <p>All family members stay in sync with real-time updates</p>
          </div>
        </div>
      </div>

      {/* Child Links Section */}
      <div className="bg-white rounded-xl shadow-lg p-6 -mt-10">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          👶 Share with Children
        </h3>
        
        <div className="bg-yellow-50 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-bold text-yellow-800 mb-2">Pro Tip!</h4>
              <p className="text-yellow-700 text-sm">
                Each child has their own special link in the Children tab. 
                Copy those links to create shortcuts on their devices so they can 
                easily check their chores and progress!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareFamily;
