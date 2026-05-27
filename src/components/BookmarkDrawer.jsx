import { Bookmark, Trash2, X, AlertTriangle } from 'lucide-react';
import { canInherit, getMaxInheritedSkills } from '../data/DataParser';

export default function BookmarkDrawer({ bookmarks, isOpen, onClose, onLoad, onDelete }) {
  return (
    <>
      <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer-panel flex flex-col gap-6 ${isOpen ? 'open' : ''}`}>
        <div className="flex justify-between items-center">
          <h2 className="flex items-center gap-2" style={{ margin: 0, fontSize: '1.2rem' }}>
            <Bookmark size={18} className="text-cyan" /> Bookmarks
          </h2>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        {bookmarks.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>No bookmarks saved yet.</p>
        ) : (
          <div className="flex flex-col" style={{ gap: '0.65rem' }}>
            {[...bookmarks].reverse().map(b => {
              const incompatibleSkills = b.targetPersona
                ? b.targetSkills.filter(s => s && !canInherit(b.targetPersona, s))
                : [];
              const maxSlots = b.targetPersona ? getMaxInheritedSkills(b.targetPersona) : 4;
              const slotOverflow = b.targetPersona
                ? Math.max(0, b.targetSkills.length - maxSlots)
                : 0;
              return (
                <div
                  key={b.id}
                  className="bookmark-item"
                  onClick={() => { onLoad(b); onClose(); }}
                >
                  <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--p3r-text)' }}>{b.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      {b.targetPersona}
                      {b.targetSkills.length > 0 ? ` \u00b7 ${b.targetSkills.length} skill${b.targetSkills.length !== 1 ? 's' : ''}` : ''}
                      {b.requiredPersonas.length > 0 ? ` \u00b7 incl. ${b.requiredPersonas.length}` : ''}
                    </div>
                    {incompatibleSkills.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#ffd54f', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> {incompatibleSkills.length} incompatible skill{incompatibleSkills.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {slotOverflow > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#ff9999', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> {slotOverflow} excess skill{slotOverflow !== 1 ? 's' : ''} (max {maxSlots})
                      </div>
                    )}
                  </div>
                  <button
                    className="icon-btn"
                    onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
                    title="Delete bookmark"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
