// src/app/messages/NotesSection.tsx

'use client';
import { useState, useEffect } from 'react';
// YENİ: 'getDoc' fonksiyonu import edildi
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { BookMarked, Trash2, Edit, Save } from 'lucide-react';

interface Note {
    id: string;
    message: string;
    timestamp: Timestamp;
    senderName: string;
    senderId: string;
}

export default function NotesSection({ chatId }: { chatId: string }) {
    const { user } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    useEffect(() => {
        if (!chatId) return;
        setLoading(true);
        const notesQuery = query(collection(db, 'notes'), where('chatId', '==', chatId), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
            setNotes(fetchedNotes);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [chatId]);

    // handleAddNote FONKSİYONU TAMAMEN YENİLENDİ
    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newNote.trim() === '' || !user) return;

        let adminName = user.displayName || 'Moderatör'; // Varsayılan isim

        try {
            // 1. Giriş yapmış kullanıcının UID'si ile 'admins' koleksiyonundaki dokümanına bir referans oluştur.
            const adminDocRef = doc(db, 'admins', user.uid);
            
            // 2. Bu dokümanı Firestore'dan çek.
            const adminDocSnap = await getDoc(adminDocRef);

            // 3. Doküman varsa ve içinde 'name' alanı bulunuyorsa, bu ismi kullan.
            if (adminDocSnap.exists() && adminDocSnap.data().name) {
                adminName = adminDocSnap.data().name;
            }
        } catch (error) {
            console.error("Admin profili çekilirken hata oluştu, varsayılan isim kullanılacak:", error);
        }

        // 4. Notu, Firestore'dan çekilen doğru isimle kaydet.
        await addDoc(collection(db, 'notes'), {
            chatId: chatId,
            message: newNote.trim(),
            senderId: user.uid,
            senderName: adminName, // <-- DEĞİŞİKLİK BURADA
            timestamp: Timestamp.now(),
        });

        setNewNote('');
    };
    
    const handleDeleteNote = async (noteId: string) => { if (window.confirm("Bu notu silmek istediğinizden emin misiniz?")) { const noteDocRef = doc(db, 'notes', noteId); await deleteDoc(noteDocRef); } };
    const startEditing = (note: Note) => { setEditingNoteId(note.id); setEditingText(note.message); };
    const handleUpdateNote = async () => { if (!editingNoteId || editingText.trim() === '') return; const noteDocRef = doc(db, 'notes', editingNoteId); await updateDoc(noteDocRef, { message: editingText.trim() }); setEditingNoteId(null); setEditingText(''); };
    const formatNoteTime = (timestamp: Timestamp) => { if (!timestamp) return ''; return new Date(timestamp.seconds * 1000).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

    return (
        <div className="bg-gray-900/50 rounded-xl p-4 mt-6">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center mb-3"> <BookMarked className="w-5 h-5 mr-2 text-violet-400" /> Sohbet Notları </h3>
            <form onSubmit={handleAddNote} className="mb-4">
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Bu sohbetle ilgili bir not ekle..." className="w-full bg-gray-800 rounded-md p-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-600" rows={3}></textarea>
                <button type="submit" disabled={!newNote.trim()} className="w-full mt-2 p-2 rounded-md bg-violet-700 text-sm font-semibold text-white disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-violet-600 transition-colors">Not Ekle</button>
            </form>
            <div className="space-y-3 max-h-60 overflow-y-auto">
                {loading && <p className="text-sm text-gray-500">Notlar yükleniyor...</p>}
                {!loading && notes.length === 0 && (<p className="text-sm text-center text-gray-500 py-4">Henüz not eklenmemiş.</p>)}
                {notes.map(note => (
                    <div key={note.id} className="bg-gray-800 p-3 rounded-lg text-sm">
                        {editingNoteId === note.id ? (
                            <div>
                                <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full bg-gray-700 rounded-md p-2 text-sm text-gray-100" rows={3} />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => setEditingNoteId(null)} className="text-xs text-gray-400 hover:text-white">İptal</button>
                                    <button onClick={handleUpdateNote} className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-500"><Save size={14} /> Kaydet</button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-gray-200 whitespace-pre-wrap">{note.message}</p>
                                <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                                    {/* Notu atan kişinin ismi artık doğru bir şekilde gösterilecek */}
                                    <span>{note.senderName} - {formatNoteTime(note.timestamp)}</span>
                                    {user && user.uid === note.senderId && (
                                        <div className="flex gap-3">
                                            <button onClick={() => startEditing(note)} className="hover:text-amber-400 transition-colors"><Edit size={14} /></button>
                                            <button onClick={() => handleDeleteNote(note.id)} className="hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}