<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# ChoreTracker App - Copilot Instructions

## Project Overview
ChoreTracker is a Progressive Web App (PWA) built with React, Vite, Tailwind CSS, and Firebase that helps families manage chores and allowances in a fun, kid-friendly way.

## Key Features
- **Parent Dashboard**: Create and manage children, assign chores, approve completions, track progress
- **Child Interface**: Kid-friendly interface to view assigned chores, mark as complete, track earnings
- **Reward System**: Dollar-based rewards with goal tracking and celebration modals
- **Real-time Updates**: Firebase Firestore for live synchronization across devices
- **PWA Capabilities**: Offline support, push notifications, installable on mobile devices
- **Family Sharing**: Multiple parents can manage the same family account

## Technical Architecture

### Frontend
- **React 18** with functional components and hooks
- **Vite** for fast development and building
- **Tailwind CSS** with custom kid-friendly theme (blue/green palette)
- **React Router** for client-side routing
- **React Hot Toast** for notifications

### Backend & Database
- **Firebase Authentication** for parent login
- **Firebase Firestore** for real-time data storage
- **Firebase Cloud Messaging** for push notifications

### Data Models
```
Parents Collection:
- email, familyName, children[], shareCode, createdAt

Children Collection:
- firstName, dateOfBirth, goalAmount, goalDescription, parentId, token, totalEarnings, completedChores[], createdAt

Chores Collection:
- title, description, category, location, type, reward, childId, parentId, instructions, status, dueDate, createdAt, completedAt, approvedAt
```

## Development Guidelines

### Component Structure
- Use functional components with hooks
- Keep components focused and single-responsibility
- Pass data down via props, lift state up when needed
- Use custom hooks for Firebase operations

### Styling Conventions
- Use Tailwind utility classes exclusively
- Follow the established color scheme (primary blue, secondary green)
- Maintain kid-friendly design with large buttons, fun emojis, and engaging animations
- Ensure responsive design with mobile-first approach

### Firebase Integration
- Use Firebase hooks pattern for real-time data
- Handle loading and error states gracefully
- Implement optimistic updates where appropriate
- Use Firestore security rules to protect data

### Kid-Friendly UX
- Large, colorful buttons with emoji icons
- Celebratory animations and success modals
- Progress bars and visual feedback
- Simple, clear language appropriate for children
- Touch-friendly interface for mobile devices

### Parent Features
- Comprehensive dashboard with analytics
- Batch operations for efficiency
- Family sharing capabilities
- Detailed chore management with instructions and deadlines

### Code Organization
```
src/
├── components/          # Reusable UI components
├── firebase.js         # Firebase configuration and utilities
├── App.jsx            # Main app component with routing
├── main.jsx           # App entry point
└── index.css          # Tailwind imports and global styles
```

## Common Patterns

### Firebase Data Fetching
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(query, (snapshot) => {
    // Handle real-time updates
  });
  return () => unsubscribe();
}, []);
```

### Toast Notifications
```javascript
import toast from 'react-hot-toast';
toast.success('Success message! 🎉');
toast.error('Error message');
```

### Responsive Design
```javascript
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
```

## Performance Considerations
- Use React.memo for expensive components
- Implement proper loading states
- Optimize Firebase queries with appropriate indexes
- Use PWA caching strategies for offline functionality

## Security Notes
- Never expose Firebase private keys in client code
- Implement proper Firestore security rules
- Validate all user inputs
- Use Firebase Auth for secure user management
