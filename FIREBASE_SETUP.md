# Firebase Setup Instructions

## Firestore Security Rules for Development

The errors you're seeing are due to restrictive Firestore security rules. To fix this during development, you need to update your Firestore security rules.

### Steps:

1. **Go to Firebase Console:**
   - Visit https://console.firebase.google.com
   - Select your project: `chore-tracker-a78f9`

2. **Navigate to Firestore:**
   - Click on "Firestore Database" in the left sidebar
   - Click on the "Rules" tab

3. **Update the Rules:**
   Replace the current rules with these development-friendly rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all authenticated users during development
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. **Publish the Rules:**
   - Click "Publish" to save the changes

### What This Does:
- Allows any authenticated user to read and write to any document
- Perfect for development and testing
- **Note:** Change to more restrictive rules for production

### Production Rules (for later):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Parents can read/write their own data
    match /parents/{parentId} {
      allow read, write: if request.auth != null && request.auth.uid == parentId;
    }
    
    // Parents can read/write children in their family
    match /children/{childId} {
      allow read, write: if request.auth != null && 
        resource.data.parentId == request.auth.uid;
    }
    
    // Parents can read/write chores they created
    match /chores/{choreId} {
      allow read, write: if request.auth != null && 
        resource.data.parentId == request.auth.uid;
    }
  }
}
```

### After Updating Rules:

1. Refresh your browser at `http://localhost:5174`
2. The "Failed to load family data" errors should disappear
3. You should be able to click on the "Children" and "Chores" tabs
4. You can add children and chores using the interface

### Troubleshooting:

If you still see errors after updating the rules:
1. Wait 1-2 minutes for the rules to propagate
2. Clear your browser cache
3. Check the browser console for any remaining errors
4. Make sure you're signed in to the correct Firebase project
