# Firestore Indexes for Admission Number Scanner

## Required Indexes for Student Search Optimization

### 1. Admission Number Index (Single Field)
Collection: `students_*` (all department collections)
Field: `admissionNumber`
Type: Ascending
Scope: Collection

### 2. Composite Index for Active Students by Admission Number
Collection: `students_*` (all department collections)
Fields:
- `isActive` (Ascending)
- `admissionNumber` (Ascending)

### 3. Roll Number Index (Single Field)
Collection: `students_*` (all department collections)  
Field: `rollNumber`
Type: Ascending
Scope: Collection

### 4. Composite Index for Active Students by Roll Number
Collection: `students_*` (all department collections)
Fields:
- `isActive` (Ascending)
- `rollNumber` (Ascending)

### 5. Department Code Index for Stats Collection
Collection: `stats`
Field: `departmentCode`
Type: Ascending
Scope: Collection

### 6. Composite Index for Active Departments with Department Code
Collection: `stats`
Fields:
- `isActive` (Ascending)
- `departmentCode` (Ascending)

### 7. Admission Scan Sessions Index
Collection: `admissionScanSessions`
Field: `activityId`
Type: Ascending
Scope: Collection

### 8. Composite Index for Admission Scan Sessions
Collection: `admissionScanSessions`
Fields:
- `activityId` (Ascending)
- `createdAt` (Descending)

## Firestore Rules for New Collections

```javascript
// Add to firestore.rules

// Admission Scan Sessions
match /admissionScanSessions/{sessionId} {
  allow read, write: if isAuthenticated() && 
    (resource == null || 
     resource.data.createdBy == request.auth.uid || 
     isAdmin());
}
```

## CLI Commands to Create Indexes

```bash
# Run these commands in your Firebase project directory

# For students collections - you'll need to run these for each department collection
firebase firestore:indexes add --index='[{"collectionGroup":"students_cse_1","queryScope":"COLLECTION","fields":[{"fieldPath":"admissionNumber","order":"ASCENDING"}]}]'

firebase firestore:indexes add --index='[{"collectionGroup":"students_cse_1","queryScope":"COLLECTION","fields":[{"fieldPath":"isActive","order":"ASCENDING"},{"fieldPath":"admissionNumber","order":"ASCENDING"}]}]'

# For stats collection
firebase firestore:indexes add --index='[{"collectionGroup":"stats","queryScope":"COLLECTION","fields":[{"fieldPath":"departmentCode","order":"ASCENDING"}]}]'

firebase firestore:indexes add --index='[{"collectionGroup":"stats","queryScope":"COLLECTION","fields":[{"fieldPath":"isActive","order":"ASCENDING"},{"fieldPath":"departmentCode","order":"ASCENDING"}]}]'

# For admission scan sessions
firebase firestore:indexes add --index='[{"collectionGroup":"admissionScanSessions","queryScope":"COLLECTION","fields":[{"fieldPath":"activityId","order":"ASCENDING"}]}]'

firebase firestore:indexes add --index='[{"collectionGroup":"admissionScanSessions","queryScope":"COLLECTION","fields":[{"fieldPath":"activityId","order":"ASCENDING"},{"fieldPath":"createdAt","order":"DESCENDING"}]}]'
```

## Alternative: firestore.indexes.json

Create or update your `firestore.indexes.json` file with these indexes:

```json
{
  "indexes": [
    {
      "collectionGroup": "stats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "departmentCode", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "stats", 
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "departmentCode", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "admissionScanSessions",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "activityId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "admissionScanSessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "activityId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Notes

1. **Single Field Indexes**: Firestore automatically creates single field indexes for basic queries, but explicit creation ensures optimal performance.

2. **Department-Specific Indexes**: Since student collections are per-department (`students_cse_1`, `students_cse_2`, etc.), you'll need to create indexes for each active department collection.

3. **Collection Group Queries**: If you want to search across all student collections simultaneously, consider using collection group queries with appropriate indexes.

4. **Performance Considerations**: These indexes will improve query performance but will also consume additional storage and write operations.

## Deployment

After updating `firestore.indexes.json`, deploy with:

```bash
firebase deploy --only firestore:indexes
```

## Monitoring

Monitor index usage in the Firebase Console under:
Firestore > Indexes > Composite tab

Check for any suggested indexes based on your actual query patterns.
