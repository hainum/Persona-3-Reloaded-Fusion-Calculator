import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { personaData } from '../data/DataParser';
import { getAllRecipes } from '../lib/FusionCalculator';
import { createPortal } from 'react-dom';

function getFuseLevel(pData, innateProvided) {
  const learnedLevels = innateProvided
    .map(skill => pData.skills[skill])
    .filter(l => l != null && l >= 1);
  return learnedLevels.length > 0 ? Math.max(...learnedLevels) : pData.lvl;
}

const PAGE_SIZE = 30;

export default function FusionPathViewer({ paths, excludedPersonas = [], onExcludePersona }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);
  const pathList = paths || [];
  const hasMore = pathList.length > visibleCount;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(v => v + PAGE_SIZE);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, pathList.length]);

  return (
    <div className="fusion-paths-container">
      {pathList.slice(0, visibleCount).map((path, index) => (
        <div key={index} className="path-card" style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h3 className="text-cyan" style={{ marginBottom: '12px', fontSize: '1.2rem', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '8px' }}>
            Path {index + 1}
          </h3>
          <TreeNode node={path} isRoot={true} excludedPersonas={excludedPersonas} onExcludePersona={onExcludePersona} />
        </div>
      ))}
      {hasMore && <div ref={sentinelRef} style={{ height: '1px' }} />}
    </div>
  );
}

function TreeNode({ node, isRoot, excludedPersonas, onExcludePersona }) {
  const [showRecipes, setShowRecipes] = useState(false);
  const popoverRef = useRef(null);
  const nodeRef = useRef(null);
  const [popoverRect, setPopoverRect] = useState(null);

  useEffect(() => {
    if (!showRecipes) return;
    const handleClick = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        nodeRef.current && !nodeRef.current.contains(e.target)
      ) {
        setShowRecipes(false);
      }
    };
    const handleScroll = () => setShowRecipes(false);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showRecipes]);

  if (!node) return null;

  const { persona, ingredients, skillsProvided, innateProvided = [], _usesCustom } = node;
  const pData = personaData[persona];
  const fuseLevel = getFuseLevel(pData, innateProvided);
  const recipes = getAllRecipes(persona);
  const hasRecipes = recipes && recipes.length > 0;

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '8px', position: 'relative' }}>
        <div
          ref={nodeRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!showRecipes) {
              setPopoverRect(nodeRef.current.getBoundingClientRect());
            }
            setShowRecipes((v) => !v);
          }}
          style={{
            display: 'inline-block',
            padding: '6px 12px',
            background: isRoot ? 'rgba(0, 229, 255, 0.15)' : 'rgba(30, 58, 95, 0.5)',
            border: `1px solid ${isRoot ? 'var(--p3r-cyan)' : 'var(--p3r-text-muted)'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 2
          }}
        >
          <strong style={{ color: isRoot ? 'var(--p3r-cyan)' : 'var(--p3r-white)' }}>
            {persona}
            <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '6px', fontWeight: 400 }}>
              (Lv.{fuseLevel})
            </span>
            {_usesCustom && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', marginLeft: '6px',
                fontSize: '0.65rem', color: '#ff9800', border: '1px solid #ff9800',
                borderRadius: '4px', padding: '0 5px', fontWeight: 600, letterSpacing: '0.5px',
                lineHeight: '1.4'
              }}>
                Custom
              </span>
            )}
          </strong>
          {!isRoot && onExcludePersona && !excludedPersonas.includes(persona) && (
            <span
              onClick={(e) => { e.stopPropagation(); onExcludePersona(persona); }}
              title={`Exclude ${persona} from results`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: '6px', width: '18px', height: '18px', borderRadius: '4px',
                cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, opacity: 0.4,
                background: 'rgba(255,80,80,0.2)', color: '#ff7777',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
            >
              <X size={12} />
            </span>
          )}
          {!isRoot && excludedPersonas.includes(persona) && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', marginLeft: '6px',
              fontSize: '0.7rem', color: '#ff7777', opacity: 0.7
            }}>
              excluded
            </span>
          )}
          {skillsProvided && skillsProvided.length > 0 && (
            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              {skillsProvided.map(skill => {
                const isInnate = innateProvided.includes(skill);
                if (isInnate) {
                  const lvl = pData.skills[skill];
                  const lvlText = lvl < 1 ? 'Base' : `Lv ${lvl}`;
                  return <div key={skill} style={{ color: '#4caf50' }}>Learns {skill} ({lvlText})</div>;
                } else {
                  return <div key={skill} style={{ color: '#ffeb3b' }}>Inherits {skill}</div>;
                }
              })}
            </div>
          )}
        </div>

        {showRecipes && popoverRect && createPortal(
          <div ref={popoverRef} style={{
            position: 'fixed',
            left: `${Math.min(popoverRect.right + 8, window.innerWidth - 220)}px`,
            top: `${Math.max(8, Math.min(popoverRect.top, window.innerHeight - 320))}px`,
            background: 'rgba(15, 20, 35, 0.97)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '10px',
            minWidth: '200px',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 10000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--p3r-cyan)' }}>
              Recipes for {persona}
            </div>
            {hasRecipes ? recipes.map((recipe, idx) => (
              <div key={idx} style={{
                fontSize: '0.8rem',
                padding: '6px 4px',
                borderBottom: idx < recipes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                color: 'var(--p3r-text-muted)'
              }}>
                {recipe.ingredients.join(' + ')}
                {recipe.isSpecial && <span style={{ color: '#ff9800', marginLeft: '6px', fontSize: '0.7rem', fontWeight: 600 }}>SPECIAL</span>}
              </div>
            )) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--p3r-text-muted)' }}>No recipes found.</div>
            )}
          </div>,
          document.body
        )}
      </div>

      {ingredients && ingredients.length > 0 && (
        <div style={{ marginLeft: '15px' }}>
          {ingredients.map((ing, idx) => {
            const isLast = idx === ingredients.length - 1;
            return (
              <div key={idx} style={{ position: 'relative', paddingLeft: '20px', paddingTop: '10px', paddingBottom: isLast ? '0' : '10px' }}>
                <div style={{
                  position: 'absolute',
                  top: '26px',
                  left: 0,
                  width: '20px',
                  height: '1px',
                  background: 'var(--p3r-text-muted)'
                }} />

                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '1px',
                  height: isLast ? '26px' : '100%',
                  background: 'var(--p3r-text-muted)'
                }} />

                <TreeNode node={ing} isRoot={false} excludedPersonas={excludedPersonas} onExcludePersona={onExcludePersona} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
