'use client';
import { useState, useEffect } from 'react';
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

export default function NotesSection({ chatId }: { chatId: string | undefined }) {
    const { user } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    useEffect(() => {
        if (!chatId) {
            setNotes([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const notesQuery = query(collection(db, 'notes'), where('chatId', '==', chatId), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
            setNotes(fetchedNotes);
            setLoading(false);
        }, (error) => {
            console.error("Notları dinlerken hata:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [chatId]);

    // NotesSection.tsx dosyasında sadece bu fonksiyonu değiştir

        const handleAddNote = async (e: React.FormEvent) => {
            e.preventDefault();
            if (newNote.trim() === '' || !user?.firebaseUser || !chatId) return;

            // Başlangıçta Auth'dan gelen ismi bir varsayılan olarak alalım
            let authorName = user.firebaseUser.displayName || 'Moderatör';

            try {
                // Firestore'daki 'admins' koleksiyonundan moderatörün özel ismini çekmeyi dene
                const adminDocRef = doc(db, 'admins', user.firebaseUser.uid);
                const adminDocSnap = await getDoc(adminDocRef);

                // Eğer o döküman varsa ve içinde 'name' alanı doluysa, onu kullanalım
                if (adminDocSnap.exists() && adminDocSnap.data().name) {
                    authorName = adminDocSnap.data().name;
                }
            } catch (error) {
                console.error("Admin ismi çekilirken hata oluştu, varsayılan isim kullanılacak:", error);
            }

            try {
                // Notu, doğru isimle Firestore'a ekle
                await addDoc(collection(db, 'notes'), {
                    chatId: chatId,
                    message: newNote.trim(),
                    senderId: user.firebaseUser.uid,
                    senderName: authorName, // Artık burada doğru isim var
                    timestamp: Timestamp.now(),
                });
                setNewNote('');
            } catch (error) {
                console.error("Not eklenirken hata:", error);
            }
        };
    const handleDeleteNote = async (noteId: string) => {
        if (!noteId || !window.confirm("Bu notu silmek istediğinizden emin misiniz?")) return;
        try {
            await deleteDoc(doc(db, 'notes', noteId));
        } catch (error) {
            console.error("Not silinirken hata:", error);
        }
    };

    const startEditing = (note: Note) => {
        setEditingNoteId(note.id);
        setEditingText(note.message);
    };

    const handleUpdateNote = async () => {
        if (!editingNoteId || editingText.trim() === '') return;
        try {
            const noteDocRef = doc(db, 'notes', editingNoteId);
            await updateDoc(noteDocRef, { message: editingText.trim() });
            setEditingNoteId(null);
            setEditingText('');
        } catch (error) {
            console.error("Not güncellenirken hata:", error);
        }
    };

    const formatNoteTime = (timestamp: Timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp.seconds * 1000).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-gray-900/50 rounded-xl p-4 mt-6">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center mb-3"> <BookMarked className="w-5 h-5 mr-2 text-violet-400" /> Sohbet Notları </h3>
            <form onSubmit={handleAddNote} className="mb-4">
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Bu sohbetle ilgili bir not ekle..." className="w-full bg-gray-800 rounded-md p-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-600" rows={3}></textarea>
                <button type="submit" disabled={!newNote.trim() || !chatId} className="w-full mt-2 p-2 rounded-md bg-violet-700 text-sm font-semibold text-white disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-violet-600 transition-colors">Not Ekle</button>
            </form>
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                {loading && <p className="text-sm text-gray-500 text-center">Notlar yükleniyor...</p>}
                {!loading && notes.length === 0 && (<p className="text-sm text-center text-gray-500 py-4">Henüz not eklenmemiş.</p>)}
                {notes.map(note => (
                    <div key={note.id} className="bg-gray-800 p-3 rounded-lg text-sm">
                {editingNoteId === note.id ? (
                    // Düzenleme modu JSX'i (değişiklik yok)
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
                            <span>{note.senderName} - {formatNoteTime(note.timestamp)}</span>
                            
                            {/* --- YENİ VE PROFESYONEL YETKİ KONTROLÜ --- */}
                            {(() => {
                                // 1. Giriş yapmış bir kullanıcı var mı?
                                if (!user?.firebaseUser) return null;

                                // 2. Kullanıcı superadmin mi?
                                const isSuperAdmin = user.customClaims?.role === 'superadmin';

                                // 3. Kullanıcı bu notun sahibi mi?
                                const isOwner = user.firebaseUser.uid === note.senderId;

                                // 4. Eğer superadmin VEYA notun sahibi ise, butonları göster.
                                if (isSuperAdmin || isOwner) {
                                    return (
                                        <div className="flex gap-3">
                                            <button onClick={() => startEditing(note)} className="hover:text-amber-400 transition-colors"><Edit size={14} /></button>
                                            <button onClick={() => handleDeleteNote(note.id)} className="hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    );
                                }
                                
                                return null; // Aksi halde hiçbir şey gösterme
                            })()}
                            {/* --- YETKİ KONTROLÜ SONU --- */}
                            
                        </div>
                    </div>
                )}
            </div>
                ))}
            </div>
        </div>
    );
}