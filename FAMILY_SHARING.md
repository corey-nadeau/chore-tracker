# Family Sharing Feature

## Overview
The family sharing feature allows multiple parents to manage the same children and chores within a single family account. This is perfect for households with two parents who both want to assign chores and approve completed tasks.

## How It Works

### Creating a New Family
1. When signing up, select "Create New Family"
2. Enter your family name (e.g., "The Smith Family")
3. A unique 6-character share code is automatically generated

### Joining an Existing Family  
1. When signing up, select "Join Existing Family"
2. Enter the 6-character family code shared by another parent
3. You'll be added to the existing family with access to all children and chores

## Features

### Shared Access
- **Children**: All family members can see and manage the same children
- **Chores**: All family members can create chores and approve completed ones
- **Real-time Sync**: Changes made by one parent are immediately visible to others

### Parent Attribution
- When viewing chores, you can see which parent created/assigned each chore
- The display shows "You" for your own chores and the parent's name for others
- This helps coordinate chore assignments and avoid duplication

### Family Management
- Each family has a unique share code visible in the Share Family tab
- The Share Family tab shows all current family members
- Family members can see each other's email addresses

## Technical Implementation

### Data Structure
- Each parent has a `familyId` and `familyMembers` array
- Children and chores are shared across all family members
- Parent attribution is tracked via `parentId` and `createdBy` fields

### Security
- Each parent maintains their own authentication
- Family sharing is based on the share code system
- All family members have equal access to family data

## Getting Started

### For the First Parent
1. Create a new account and family
2. Add your children in the Children tab
3. Share your family code from the Share Family tab

### For Additional Parents
1. Get the family code from an existing parent
2. Create a new account and select "Join Existing Family"
3. Enter the family code during signup
4. You'll immediately have access to all family data

## Benefits
- Both parents can assign chores without coordination
- Either parent can approve completed chores
- Consistent reward tracking across both parents
- Clear visibility of who set which chores
- Synchronized family management

This feature makes ChoreTracker perfect for two-parent households while maintaining simplicity for single-parent use.
