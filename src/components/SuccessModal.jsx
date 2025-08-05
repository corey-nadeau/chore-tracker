import { useEffect, useState } from 'react';

function SuccessModal({ chore, child, onClose }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setShowModal(true);
    const timer = setTimeout(() => {
      setShowModal(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const encouragements = [
    "Amazing work! 🌟",
    "You're incredible! 🚀",
    "Super job! 💪",
    "Outstanding! 🎉",
    "Fantastic! ⭐",
    "You rock! 🎸",
    "Brilliant! 💎",
    "Awesome! 🔥"
  ];

  const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
      showModal ? 'bg-black bg-opacity-50' : 'bg-transparent pointer-events-none'
    }`}>
      <div className={`bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center transform transition-all duration-300 ${
        showModal ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
      }`}>
        <div className="text-8xl mb-4 animate-bounce">🎉</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {randomEncouragement}
        </h2>
        <p className="text-xl text-gray-600 mb-4">
          You completed "{chore.title}"!
        </p>
        <div className="bg-green-100 rounded-xl p-4 mb-4">
          <div className="text-2xl font-bold text-green-600">
            +${chore.reward}
          </div>
          <div className="text-sm text-green-700">
            Waiting for parent approval
          </div>
        </div>
        <div className="flex justify-center space-x-2">
          <div className="text-2xl animate-pulse">⭐</div>
          <div className="text-2xl animate-pulse delay-100">⭐</div>
          <div className="text-2xl animate-pulse delay-200">⭐</div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Great job, {child.firstName}! Keep up the excellent work!
        </p>
      </div>
    </div>
  );
}

export default SuccessModal;
