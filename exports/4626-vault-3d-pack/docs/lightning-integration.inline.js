              branchEls.push({ bMid, bCore, atFraction: idx / main.pts.length, drawScale: 0.55 });
              primaryBranches.push({ pts: bd.pts, parentFraction: idx / main.pts.length });
            }
            // Secondary branches off the primary branches — fine micro-forks
            primaryBranches.forEach((pb) => {
              const secCount = Math.round(rand(1, 3));
              for (let j = 0; j < secCount; j++) {
                if (Math.random() > branchProb * 0.6) continue;
                const idx = Math.floor(rand(2, Math.max(3, pb.pts.length - 1)));
                const p = pb.pts[idx];
                const baseAng = 90 + rand(-80, 80);
                const len = rand(25, 70) * scale;
                const segs = Math.round(rand(4, 7));
                const jit = rand(10, 22) * scale;
                const bd = buildBoltPath(p.x, p.y, p.x + Math.cos(baseAng * Math.PI / 180) * len, p.y + Math.sin(baseAng * Math.PI / 180) * len, segs, jit);
                const bMid = makePath(bd.d, 0.7 * scale, 0.4);
                bMid.setAttribute('stroke', 'rgba(255, 230, 180, 1)');
                const bCore = makePath(bd.d, 0.32 * scale, 0.85);
                bCore.setAttribute('stroke', 'rgba(255, 250, 230, 1)');
                group.appendChild(bMid);
                group.appendChild(bCore);
                // Secondary branches start once primary is well underway
                branchEls.push({ bMid, bCore, atFraction: pb.parentFraction + 0.15, drawScale: 0.4 });
              }
            });
          }

          layer.appendChild(group);

          // Animation timing
          const drawMs = 220 + rand(0, 140);   // light travels down the bolt
          const holdMs = 60 + rand(0, 80);     // brief held flash
          const fadeMs = 360 + rand(0, 220);   // gentle fade

          // Draw main path (all 3 layers travel together)
          [halo, mid, core].forEach((el) => animateDraw(el, drawMs, holdMs, fadeMs));

          // Branches kick in slightly after the main bolt reaches their attach point
          branchEls.forEach(({ bMid, bCore, atFraction, drawScale }) => {
            const branchDelay = drawMs * Math.min(0.92, atFraction * 0.85);
            setTimeout(() => {
              animateDraw(bMid,  drawMs * (drawScale || 0.55), holdMs, fadeMs);
              animateDraw(bCore, drawMs * (drawScale || 0.55), holdMs, fadeMs);
            }, branchDelay);
          });

          if (withFlicker && Math.random() < 0.5) {
            const flickAt = drawMs + holdMs * 0.3 + rand(20, 80);
            flicker(core, flickAt);
            flicker(mid, flickAt);
          }

          // Cleanup the group well after everything is gone
          setTimeout(() => { group.remove(); }, drawMs + holdMs + fadeMs + 600);

          return { drawMs, holdMs, fadeMs };
        }

        function fire(el) {
          el.classList.remove('is-firing');
          void el.offsetWidth;
          el.classList.add('is-firing');
        }

        function strike() {
          const r = Math.random();
          let intensity, scale;
          if (r < 0.5) {
            // small distant strike — 1 thin bolt, soft flash
            intensity = 0.55; scale = 0.7;
            spawnBolt({ scale, branchProb: 0.35 });
          } else if (r < 0.85) {
            // medium — 1 main bolt with branches, brighter flash
            intensity = 1.0; scale = 1.0;
            spawnBolt({ scale, branchProb: 0.7 });
            // sometimes a faint distant secondary
            if (Math.random() < 0.4) {
              setTimeout(() => spawnBolt({ scale: 0.55, branchProb: 0.25 }), 80 + Math.random() * 200);
            }
          } else {
            // BIG — 2 bolts close in time, big sky flash
            intensity = 1.7; scale = 1.25;
            spawnBolt({ scale, branchProb: 0.85 });
            setTimeout(() => spawnBolt({ scale: scale * 0.9, branchProb: 0.7 }), 60 + Math.random() * 120);
          }
          fire(flash);
          window.dispatchEvent(new CustomEvent('vault:lightning', { detail: { intensity } }));

          // 35% chance of a faint after-flicker bolt
          if (Math.random() < 0.35) {
            setTimeout(() => {
              spawnBolt({ scale: 0.5, branchProb: 0.2, withFlicker: false });
              fire(flash);
              window.dispatchEvent(new CustomEvent('vault:lightning', { detail: { intensity: 0.45 } }));
            }, 280 + Math.random() * 360);
          }
        }

        function schedule() {
          const next = 2500 + Math.random() * 4500;
          setTimeout(() => { strike(); schedule(); }, next);
        }
        setTimeout(() => { strike(); schedule(); }, 1500);
      })();
