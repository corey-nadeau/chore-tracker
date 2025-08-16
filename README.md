# 🏆 ChoreTracker - Family Chore & Allowance Manager

A fun, engaging Progressive Web App that helps families manage chores and allowances with a kid-friendly reward system. Built with React, Firebase, and lots of love for making chores exciting! 

## ✨ Features

### 👨‍👩‍👧‍👦 For Parents
- **Family Management**: Add multiple children with individual goals and tracking
- **Chore Creation**: Create detailed chores with categories, locations, rewards, and instructions
- **Approval System**: Review and approve completed chores with notification system
- **Progress Tracking**: Real-time dashboard showing family progress and earnings
- **Multi-Parent Support**: Share family management with other parents via secure codes
- **Goal Management**: Set and update earning goals with custom descriptions

### 👶 For Kids
- **Kid-Friendly Interface**: Colorful, fun design with emojis and animations
- **Easy Chore Viewing**: See assigned chores with clear instructions and rewards
- **One-Click Completion**: Simple "Mark Complete" button with celebration animations
- **Progress Visualization**: Visual progress bars showing earnings toward goals
- **Instant Feedback**: Success modals and encouraging messages for completed tasks

### 📱 PWA Features
- **Installable**: Add to home screen on mobile devices
- **Offline Support**: View chores and track progress without internet
- **Push Notifications**: Real-time notifications for chore approvals
- **Cross-Platform**: Works on iOS, Android, and desktop browsers

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Firebase account and project
- Modern web browser

### Installation

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd chore_tracking
npm install
```

2. **Firebase Setup:**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Enable Cloud Messaging (optional, for notifications)
   - Copy config keys to `src/firebase.js`

3. **Start development server:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
```

## 🎯 How It Works

### Getting Started
1. **Parent Registration**: Parents create an account with family name
2. **Add Children**: Input child's name, birth date, and earning goals  
3. **Create Chores**: Set up chores with categories, locations, and rewards
4. **Share with Kids**: Each child gets a unique link to access their dashboard

### Daily Workflow
1. **Kids check their chores** using their personal link
2. **Complete tasks** and mark them done with celebration
3. **Parents review** and approve completed chores
4. **Earnings accumulate** toward the child's goal
5. **Celebrate achievements** when goals are reached!

## 🏗️ Project Structure

```
chore_tracking/
├── src/
│   ├── components/           # React components
│   │   ├── Login.jsx        # Parent authentication
│   │   ├── ParentDashboard.jsx   # Main parent interface
│   │   ├── ChildDashboard.jsx    # Kid-friendly interface
│   │   ├── ChildManagement.jsx   # Add/edit children
│   │   ├── ChoreManagement.jsx   # Create/manage chores
│   │   ├── ShareFamily.jsx       # Family sharing features
│   │   ├── SuccessModal.jsx      # Celebration modal
│   │   └── Loading.jsx           # Loading states
│   ├── firebase.js          # Firebase configuration
│   ├── App.jsx             # Main app with routing
│   └── main.jsx            # Entry point
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js              # Service worker
│   └── icons/             # App icons
└── tailwind.config.js     # Tailwind configuration
```

## 🎨 Design System

### Color Palette
- **Primary Blue**: `#0ea5e9` (Sky blue for trust and reliability)
- **Secondary Green**: `#22c55e` (Success green for achievements)
- **Kid-Friendly**: Bright, cheerful colors with high contrast

### Typography
- **Font**: Comic Neue (playful, readable font for kids)
- **Sizes**: Large text and buttons for easy mobile interaction

### Components
- **Rounded corners**: Friendly, approachable design
- **Generous padding**: Touch-friendly interface
- **Smooth animations**: Engaging micro-interactions
- **Emoji integration**: Visual communication kids understand

## 🔧 Configuration

### Environment Variables
Create a `.env` file with your Firebase configuration:
```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config
```

### Firebase Security Rules
```javascript
// Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /parents/{parentId} {
      allow read, write: if request.auth != null && request.auth.uid == parentId;
    }
    match /children/{childId} {
      allow read, write: if request.auth != null;
    }
    match /chores/{choreId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📊 Data Models

### Parent Document
```javascript
{
  email: "parent@example.com",
  familyName: "The Smith Family",
  children: ["child1_id", "child2_id"],
  shareCode: "ABC123",
  createdAt: timestamp
}
```

### Child Document
```javascript
{
  firstName: "Emma",
  dateOfBirth: timestamp,
  goalAmount: 25.00,
  goalDescription: "New bicycle",
  parentId: "parent_id",
  token: "CHILD123",
  totalEarnings: 12.50,
  completedChores: ["chore1_id", "chore2_id"],
  createdAt: timestamp
}
```

### Chore Document
```javascript
{
  title: "Clean your room",
  description: "Make bed, put toys away, vacuum",
  category: "cleaning",
  location: "Bedroom",
  type: "inside",
  reward: 5.00,
  childId: "child_id",
  parentId: "parent_id",
  instructions: "Don't forget under the bed!",
  status: "assigned", // assigned, pending_approval, approved, rejected
  dueDate: timestamp,
  createdAt: timestamp,
  completedAt: timestamp,
  approvedAt: timestamp
}
```

## 🚀 Deployment

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

### Netlify
```bash
npm run build
# Deploy dist/ folder to Netlify
```

### Vercel
```bash
npm install -g vercel
vercel
```

## 🔒 Security & Environment Setup

### Environment Variables

Create a `.env` file in the root directory with your Firebase configuration:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id_here
```

**Important Note**: Firebase client-side configuration (including API keys) are designed to be public and are not sensitive data. They identify your Firebase project and are safe to expose in client-side applications. Security is enforced through Firebase Security Rules, not by hiding the configuration.

### Deployment Environment Variables

When deploying to platforms like Netlify, Vercel, or others, add the same environment variables to your deployment platform's environment variable settings.

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Parents can only access their own data
    match /parents/{parentId} {
      allow read, write: if request.auth != null && request.auth.uid == parentId;
    }
    
    // Children can only be accessed by their parent
    match /children/{childId} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/parents/$(request.auth.uid)) &&
        childId in get(/databases/$(database)/documents/parents/$(request.auth.uid)).data.children;
    }
    
    // Chores can only be accessed by the parent who created them
    match /chores/{choreId} {
      allow read, write: if request.auth != null && 
        resource.data.parentId == request.auth.uid;
    }
    
    // Goals can only be accessed by the parent
    match /goals/{goalId} {
      allow read, write: if request.auth != null && 
        resource.data.parentId == request.auth.uid;
    }
  }
}
```

### Security Considerations

- 🔐 Environment variables protect Firebase configuration
- 🛡️ Firestore security rules restrict data access to authorized users
- 🚫 No sensitive data stored in client-side code
- 📁 `.env` file excluded from version control
- 🔑 Authentication required for all data access

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- Icons and emojis for making the app kid-friendly
- Firebase for reliable backend infrastructure
- Tailwind CSS for rapid UI development
- The families who inspired this project!

## 📞 Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check the documentation
- Contact the development team

---

**Made with ❤️ for families who want to make chores fun!** 🏠✨
