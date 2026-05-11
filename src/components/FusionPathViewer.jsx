import { useState, useEffect, useRef } from 'react';
import { personaData } from '../data/DataParser';
import { getAllRecipes } from '../lib/FusionCalculator';

export default function FusionPathViewer({ paths }) {
  if (!paths || paths.length === 0) return null;

  return (
    <div className="fusion-paths-container">
      {paths.map((path, index) => (
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
          <TreeNode node={path} isRoot={true} />
        </div>
      ))}
    </div>
  );
}

function TreeNode({ node, isRoot }) {
  const [showRecipes, setShowRecipes] = useState(false);
  const popoverRef = useRef(null);
  const nodeRef = useRef(null);

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
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRecipes]);

  if (!node) return null;

  const { persona, ingredients, skillsProvided, innateProvided = [] } = node;
  const pData = personaData[persona];
  const recipes = getAllRecipes(persona);
  const hasRecipes = recipes && recipes.length > 0;

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '8px', position: 'relative' }}>
        <div
          ref={nodeRef}
          onClick={(e) => { e.stopPropagation(); setShowRecipes((v) => !v); }}
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
          <strong style={{ color: isRoot ? 'var(--p3r-cyan)' : 'var(--p3r-white)' }}>{persona}</strong>
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

        {showRecipes && (
          <div ref={popoverRef} style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            marginLeft: '6px',
            background: 'rgba(15, 20, 35, 0.97)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '10px',
            minWidth: '200px',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 1000,
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
          </div>
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

                <TreeNode node={ing} isRoot={false} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
