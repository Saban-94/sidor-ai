import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function cleanupBadMediaUrls() {
  console.log('Starting Firestore media cleanup...');
  
  const badPatterns = ['unsplash.com', 'placeholder.com'];
  const collections = ['user_magic_pages', 'orders', 'office_messages'];

  for (const collName of collections) {
    try {
      const q = query(collection(db, collName));
      const snapshot = await getDocs(q);
      
      let count = 0;
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const updates: any = {};
        
        // Check standard fields
        ['avatarUrl', 'imageUrl', 'fileUrl', 'avatar'].forEach(field => {
          if (data[field] && typeof data[field] === 'string') {
            if (badPatterns.some(pattern => data[field].includes(pattern))) {
              updates[field] = null;
            }
          }
        });

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, collName, docSnap.id), updates);
          count++;
        }
      }
      console.log(`Cleaned up ${count} documents in ${collName}`);
    } catch (error) {
      console.error(`Error cleaning up ${collName}:`, error);
    }
  }
  
  console.log('Cleanup finished.');
}
