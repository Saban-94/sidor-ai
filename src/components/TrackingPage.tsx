import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const TrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    // חיפוש ההזמנה לפי ה-trackingId
    const q = query(collection(db, 'orders'), where('trackingId', '==', id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setOrder(snapshot.docs[0].data());
      } else {
        setOrder(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) return <div className="p-10 text-center font-bold">טוען נתוני דף קסם...</div>;
  if (!order) return <div className="p-10 text-center text-red-500 font-bold">אופס! הזמנה לא נמצאה.</div>;

  const steps = ['received', 'processing', 'on_the_way', 'supplied'];
  const currentStep = steps.indexOf(order.status) !== -1 ? steps.indexOf(order.status) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-blue-50">
        <div className="bg-blue-900 p-6 text-white text-center">
          <h1 className="text-2xl font-black">סבן חומרי בניין</h1>
          <p className="opacity-80">מעקב הזמנה # {order.orderNumber}</p>
        </div>

        <div className="p-6">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">סטטוס משלוח</h2>
            {/* Progress Bar */}
            <div className="relative flex justify-between">
              {steps.map((step, index) => (
                <div key={step} className="flex flex-col items-center z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index <= currentStep ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {index + 1}
                  </div>
                </div>
              ))}
              <div className="absolute top-4 left-0 w-full h-1 bg-gray-200 -z-0"></div>
              <div className="absolute top-4 right-0 h-1 bg-blue-900 transition-all duration-500" style={{ width: `${(currentStep / 3) * 100}%` }}></div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between"><span className="text-gray-500">לקוח:</span><span className="font-bold">{order.customerName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">כתובת:</span><span className="font-bold">{order.destination}</span></div>
            <div className="bg-blue-50 p-4 rounded-2xl">
              <p className="text-sm text-blue-800 font-bold mb-1">הודעה מהסידור:</p>
              <p className="text-blue-900">{order.status === 'pending' ? 'ההזמנה ממתינה לשיבוץ נהג' : 'ההזמנה בטיפול מחלקת הלוגיסטיקה'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
