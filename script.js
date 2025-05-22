const GRID_SIZE = 10;
let currentStepIndex = 0;
let autoPlayInterval = null;
let currentMode = 'demo';
let playbackSpeed = 2000;
let walkingSpeed = 500;
let isWalking = false;
let character = null;
let walkingInterval = null;
let currentWalkStep = 0;
let autoScroll = true;
let startTime = Date.now();
let isDrawingPath = false;
let isMouseDown = false;
let gameState = {
    start: [0, 0],
    goal: [9, 9],
    obstacles: [[2,2], [2,3], [3,3], [5,5], [5,6], [6,5], [7,8]],
    dynamicObstacles: [],
    currentPath: [],
    customPath: [], // Caminho personalizado desenhado pelo usuário
    waypoints: [], // Pontos de passagem obrigatórios
    visitedCells: [], // Células que o robô já visitou
    steppedCells: [], // Células que o robô REALMENTE pisou
    detourCells: [], // Células visitadas durante desvios
    originalPath: [], // Caminho original antes dos desvios
    isOnDetour: false, // Flag para indicar se está desviando
    stats: {
        cellsProcessed: 0,
        dynamicObstacles: 0,
        replanningCount: 0,
        pathLength: 0
    }
};

const demoSteps = [
    {
        title: "🎯 Cenário Inicial",
        description: "Bot precisa ir de (0,0) para (9,9). Alguns obstáculos já existem no mapa.",
        obstacles: [[2,2], [2,3], [3,3], [5,5], [5,6], [6,5], [7,8]],
        dynamicObstacles: [],
        currentPath: [],
        showComparison: false
    },
    {
        title: "🧠 Calculando Caminho Original",
        description: "A* encontra o melhor caminho evitando obstáculos estáticos.",
        obstacles: [[2,2], [2,3], [3,3], [5,5], [5,6], [6,5], [7,8]],
        dynamicObstacles: [],
        currentPath: [[0,0], [1,1], [1,2], [1,3], [1,4], [2,5], [3,6], [4,7], [5,8], [6,9], [7,9], [8,9], [9,9]],
        showComparison: false
    },
    {
        title: "⚠️ Pokémon Aparece!",
        description: "Um Pokémon selvagem bloqueia o caminho em (1,2)!",
        obstacles: [[2,2], [2,3], [3,3], [5,5], [5,6], [6,5], [7,8]],
        dynamicObstacles: [[1,2]],
        currentPath: [[0,0], [1,1]],
        blockedPath: [[1,2], [1,3], [1,4], [2,5], [3,6], [4,7], [5,8], [6,9], [7,9], [8,9], [9,9]],
        showComparison: false
    },
    {
        title: "🚀 A* Adaptativo em Ação",
        description: "Mantém o progresso e recalcula apenas a parte necessária.",
        obstacles: [[2,2], [2,3], [3,3], [5,5], [5,6], [6,5], [7,8]],
        dynamicObstacles: [[1,2]],
        currentPath: [[0,0], [1,1]],
        newPath: [[2,1], [3,2], [4,2], [4,3], [4,4], [4,5], [4,6], [4,7], [5,8], [6,9], [7,9], [8,9], [9,9]],
        showComparison: true,
        traditionalCost: "64 células",
        adaptiveCost: "18 células",
        savings: "72%"
    }
];

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(mode + '-btn').classList.add('active');
    
    // Controlar visibilidade dos controles baseado no modo
    const mainControls = document.getElementById('main-controls');
    const speedControls = document.getElementById('speed-controls');
    const drawingControls = document.getElementById('drawing-controls');
    
    if (mode === 'custom') {
        // Modo Desenhar: apenas controles de desenho
        mainControls.style.display = 'none';
        speedControls.style.display = 'none';
        drawingControls.style.display = 'flex';
        enablePathDrawing();
    } else {
        // Modos Demo e Interativo: controles principais + velocidade
        mainControls.style.display = 'flex';
        speedControls.style.display = 'block';
        drawingControls.style.display = 'none';
        disablePathDrawing();
        
        if (mode === 'interactive') {
            calculateAndShowPath();
        } else {
            resetDemo();
        }
    }
}

function updateSpeed(value) {
    playbackSpeed = parseInt(value);
    document.getElementById('speed-display').textContent = (value / 1000) + 's';
}

function updateStats() {
    document.getElementById('cells-processed').textContent = gameState.stats.cellsProcessed;
    document.getElementById('dynamic-obstacles').textContent = gameState.stats.dynamicObstacles;
    document.getElementById('replanning-count').textContent = gameState.stats.replanningCount;
    document.getElementById('path-length').textContent = gameState.stats.pathLength;
}

function updateGridVisually() {
    // Atualiza apenas o visual das células sem recriar o grid inteiro
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.getElementById(`cell-${row}-${col}`);
            if (!cell) continue;
            
            // Resetar classes (exceto coordenadas)
            cell.className = 'cell';
            
            // Manter apenas as coordenadas
            const coordDiv = cell.querySelector('.coords');
            cell.innerHTML = '';
            if (coordDiv) {
                cell.appendChild(coordDiv);
            }
            
            // Aplicar estilos baseados no estado atual (ORDEM IMPORTA!)
            if (row === gameState.start[0] && col === gameState.start[1]) {
                cell.className += ' start';
                cell.innerHTML += '<div>S</div>';
            } else if (row === gameState.goal[0] && col === gameState.goal[1]) {
                cell.className += ' goal';
                cell.innerHTML += '<div>G</div>';
            } else if (gameState.obstacles.some(obs => obs[0] === row && obs[1] === col)) {
                cell.className += ' obstacle';
                cell.innerHTML += '<div>#</div>';
            } else if (gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
                cell.className += ' dynamic-obstacle';
                cell.innerHTML += '<div>P</div>';
            } else if (gameState.waypoints.some(p => p[0] === row && p[1] === col)) {
                // PRIORIDADE: Waypoints definidos pelo usuário
                cell.className += ' waypoint';
                cell.innerHTML += '<div>⭐</div>';
            } else if (gameState.steppedCells.some(p => p[0] === row && p[1] === col)) {
                // Células que o robô REALMENTE pisou
                cell.className += ' stepped';
                cell.innerHTML += '<div>👣</div>';
            } else if (gameState.customPath.some(p => p[0] === row && p[1] === col)) {
                // Caminho personalizado desenhado pelo usuário
                cell.className += ' custom-path';
                cell.innerHTML += '<div>✏️</div>';
            } else if (gameState.detourCells.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' detour';
                cell.innerHTML += '<div>↗</div>';
            } else if (gameState.visitedCells.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' visited';
                cell.innerHTML += '<div>•</div>';
            } else if (gameState.currentPath.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' path';
                cell.innerHTML += '<div>→</div>';
            }
            
            // Re-adicionar coordenadas se necessário
            if (!cell.querySelector('.coords')) {
                const coordDiv = document.createElement('div');
                coordDiv.className = 'coords';
                coordDiv.textContent = row + ',' + col;
                cell.appendChild(coordDiv);
            }
        }
    }
}

function createGrid(stepData = null) {
    const grid = document.getElementById('grid');
    const stepInfo = document.getElementById('current-step-info');
    const comparison = document.getElementById('comparison');
    
    grid.innerHTML = '';
    
    // Remove personagem existente
    if (character) {
        character.remove();
        character = null;
    }
    
    if (stepData) {
        stepInfo.innerHTML = `<h3>${stepData.title}</h3><p>${stepData.description}</p>`;
        
        if (stepData.showComparison) {
            comparison.style.display = 'block';
            document.getElementById('traditional-cost').textContent = stepData.traditionalCost;
            document.getElementById('adaptive-cost').textContent = stepData.adaptiveCost;
            document.getElementById('savings').textContent = stepData.savings;
        } else {
            comparison.style.display = 'none';
        }
    } else {
        stepInfo.innerHTML = '<h3>🎮 Modo Interativo</h3><p>Clique nas células para adicionar obstáculos e veja o bonequinho se adaptar!</p>';
        comparison.style.display = 'none';
    }
    
    // Posição do grid para cálculos do personagem
    const gridRect = grid.getBoundingClientRect();
    
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.id = `cell-${row}-${col}`;
            
            // Coordenadas
            const coordDiv = document.createElement('div');
            coordDiv.className = 'coords';
            coordDiv.textContent = row + ',' + col;
            cell.appendChild(coordDiv);
            
            // Evento de clique para modo interativo ou desenho
            if (currentMode === 'interactive') {
                cell.addEventListener('click', () => handleCellClick(row, col));
            } else if (currentMode === 'custom') {
                // Modo desenhar: permitir AMBOS clique interativo E desenho
                cell.addEventListener('click', () => handleCellClick(row, col)); // Clique para obstáculos
                cell.addEventListener('mousedown', (e) => handlePathDrawingStart(row, col, e)); // Desenho
                cell.addEventListener('mouseover', () => handlePathDrawingMove(row, col));
                cell.addEventListener('mouseup', () => handlePathDrawingEnd(row, col));
            }
            
            // Determinar tipo de célula
            const obstacles = stepData ? stepData.obstacles : gameState.obstacles;
            const dynamicObstacles = stepData ? stepData.dynamicObstacles : gameState.dynamicObstacles;
            const currentPath = stepData ? stepData.currentPath : gameState.currentPath;
            
            if (row === gameState.start[0] && col === gameState.start[1]) {
                cell.className += ' start';
                cell.innerHTML += '<div>S</div>';
            } else if (row === gameState.goal[0] && col === gameState.goal[1]) {
                cell.className += ' goal';
                cell.innerHTML += '<div>G</div>';
            } else if (obstacles && obstacles.some(obs => obs[0] === row && obs[1] === col)) {
                cell.className += ' obstacle';
                cell.innerHTML += '<div>#</div>';
            } else if (dynamicObstacles && dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
                cell.className += ' dynamic-obstacle';
                cell.innerHTML += '<div>P</div>';
            } else if (gameState.waypoints.some(p => p[0] === row && p[1] === col)) {
                // PRIORIDADE: Waypoints definidos pelo usuário
                cell.className += ' waypoint';
                cell.innerHTML += '<div>⭐</div>';
            } else if (gameState.steppedCells.some(p => p[0] === row && p[1] === col)) {
                // Células que o robô REALMENTE pisou
                cell.className += ' stepped';
                cell.innerHTML += '<div>👣</div>';
            } else if (gameState.customPath.some(p => p[0] === row && p[1] === col)) {
                // Caminho personalizado desenhado pelo usuário
                cell.className += ' custom-path';
                cell.innerHTML += '<div>✏️</div>';
            } else if (gameState.detourCells.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' detour';
                cell.innerHTML += '<div>↗</div>';
            } else if (gameState.visitedCells.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' visited';
                cell.innerHTML += '<div>•</div>';
            } else if (stepData && stepData.newPath && stepData.newPath.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' new-path';
                cell.innerHTML += '<div>→</div>';
            } else if (currentPath && currentPath.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' path';
                cell.innerHTML += '<div>→</div>';
            } else if (stepData && stepData.blockedPath && stepData.blockedPath.some(p => p[0] === row && p[1] === col)) {
                cell.className += ' path';
                cell.innerHTML += '<div>✗</div>';
                cell.style.opacity = '0.3';
            }
            
            grid.appendChild(cell);
        }
    }
    
    // Criar personagem na posição inicial
    createCharacter();
    updateStats();
    
    // Log da criação do grid
    if (currentMode === 'interactive') {
        addLogEntry('system', 'Grid atualizado - Caminho recalculado');
    }
}

function createCharacter() {
    if (character) {
        character.remove();
    }
    
    character = document.createElement('div');
    character.className = 'character';
    character.id = 'walking-character';
    
    // Posicionar o personagem na célula inicial usando posicionamento relativo ao grid
    const startCell = document.getElementById(`cell-${gameState.start[0]}-${gameState.start[1]}`);
    if (startCell) {
        // Calcular posição baseada no índice da célula no grid
        const cellSize = 47; // 45px width + 2px gap
        const gridPadding = 20; // padding do grid
        
        const left = gameState.start[1] * cellSize + gridPadding + 5; // 5px para centralizar
        const top = gameState.start[0] * cellSize + gridPadding + 5;
        
        character.style.position = 'absolute';
        character.style.left = left + 'px';
        character.style.top = top + 'px';
        
        document.getElementById('grid').style.position = 'relative';
        document.getElementById('grid').appendChild(character);
        
        // Log da criação do personagem
        addLogEntry('system', `Robô posicionado em <span class="log-coordinates">(${gameState.start[0]},${gameState.start[1]})</span>`);
    }
}

function moveCharacterToCell(row, col, callback = null) {
    if (!character) return;
    
    const targetCell = document.getElementById(`cell-${row}-${col}`);
    if (!targetCell) return;
    
    // MARCAR A CÉLULA COMO PISADA IMEDIATAMENTE
    if (!gameState.steppedCells.some(p => p[0] === row && p[1] === col)) {
        gameState.steppedCells.push([row, col]);
        addLogEntry('movement', `👣 Pisou em <span class="log-coordinates">(${row},${col})</span>`);
        
        // Atualizar visual imediatamente
        updateGridVisually();
    }
    
    // Log do movimento
    addLogEntry('movement', `Movendo para <span class="log-coordinates">(${row},${col})</span>`);
    
    // Calcular nova posição baseada no índice da célula
    const cellSize = 47; // 45px width + 2px gap
    const gridPadding = 20; // padding do grid
    
    const newLeft = col * cellSize + gridPadding + 5; // 5px para centralizar
    const newTop = row * cellSize + gridPadding + 5;
    
    // Adicionar classe de movimento
    character.classList.add('moving', 'walking');
    
    // Criar rastro na posição atual
    const currentLeft = parseInt(character.style.left);
    const currentTop = parseInt(character.style.top);
    createTrail(currentLeft + 17.5, currentTop + 17.5);
    
    // Animar movimento
    character.style.left = newLeft + 'px';
    character.style.top = newTop + 'px';
    
    // Remover classes após animação
    setTimeout(() => {
        if (character) {
            character.classList.remove('moving', 'walking');
            if (callback) callback();
        }
    }, 300);
}

function createTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'trail';
    trail.style.left = (x - 10) + 'px';
    trail.style.top = (y - 10) + 'px';
    
    document.getElementById('grid').appendChild(trail);
    
    // Remove o rastro após a animação
    setTimeout(() => {
        if (trail.parentNode) {
            trail.parentNode.removeChild(trail);
        }
    }, 1000);
}

function startWalking() {
    if (isWalking) {
        stopWalking();
        return;
    }
    
    const path = gameState.currentPath;
    if (!path || path.length === 0) {
        addLogEntry('error', 'Nenhum caminho disponível! Calcule um caminho primeiro.');
        alert('Nenhum caminho disponível! Calcule um caminho primeiro.');
        return;
    }
    
    isWalking = true;
    // Se já estamos na posição inicial, começar do próximo passo
    currentWalkStep = (path[0][0] === gameState.start[0] && path[0][1] === gameState.start[1]) ? 1 : 0;
    document.getElementById('walk-btn').textContent = '⏹️ Parar';
    
    addLogEntry('system', `🚶 Iniciando caminhada - ${path.length} passos planejados`);
    addLogEntry('pathfinding', `Rota: ${path.map(p => `(${p[0]},${p[1]})`).join(' → ')}`);
    
    // Começar a caminhada
    walkNextStep();
}

function walkNextStep() {
    if (!isWalking || currentWalkStep >= gameState.currentPath.length) {
        // Chegou ao fim
        if (character && currentWalkStep > 0) {
            const finalPos = gameState.currentPath[currentWalkStep - 1];
            if (finalPos[0] === gameState.goal[0] && finalPos[1] === gameState.goal[1]) {
                character.classList.add('celebrating');
                addLogEntry('success', `🎉 DESTINO ALCANÇADO! Robô chegou em <span class="log-coordinates">(${gameState.goal[0]},${gameState.goal[1]})</span>`);
                addLogEntry('system', `✅ Missão completa em ${currentWalkStep} movimentos!`);
                setTimeout(() => {
                    if (character) character.classList.remove('celebrating');
                }, 1000);
            } else {
                addLogEntry('error', `❌ Caminho incompleto! Parou em <span class="log-coordinates">(${finalPos[0]},${finalPos[1]})</span> em vez de <span class="log-coordinates">(${gameState.goal[0]},${gameState.goal[1]})</span>`);
            }
        } else {
            addLogEntry('error', '❌ Nenhum movimento realizado!');
        }
        stopWalking();
        return;
    }
    
    const nextPos = gameState.currentPath[currentWalkStep];
    
    // Verificar se a próxima posição está bloqueada
    const isBlocked = gameState.dynamicObstacles.some(obs => 
        obs[0] === nextPos[0] && obs[1] === nextPos[1]
    );
    
    if (isBlocked && currentWalkStep > 0) {
        // Obstáculo encontrado! Recalcular caminho A PARTIR DA POSIÇÃO ATUAL
        const currentPos = gameState.currentPath[currentWalkStep - 1];
        addLogEntry('obstacle', `⚠️ Obstáculo detectado em <span class="log-coordinates">(${nextPos[0]},${nextPos[1]})</span>!`);
        addLogEntry('pathfinding', `🧠 A* Adaptativo ativado - Analisando opções de <span class="log-coordinates">(${currentPos[0]},${currentPos[1]})</span>...`);
        addLogEntry('system', `🎯 Tentando manter o máximo do caminho original desenhado pelo usuário`);
        
        if (character) {
            character.classList.add('blocked');
            setTimeout(() => {
                if (character) character.classList.remove('blocked');
            }, 500);
        }
        
        // Simular recálculo do A* Adaptativo INTELIGENTE
        setTimeout(() => {
            gameState.stats.replanningCount++;
            
            // ESTRATÉGIA INTELIGENTE: Tentar reconectar ao caminho original
            const remainingOriginalPath = gameState.currentPath.slice(currentWalkStep + 1);
            let bestReconnectionPath = null;
            let bestReconnectionIndex = -1;
            let shortestDetour = Infinity;
            
            addLogEntry('pathfinding', `🔍 Analisando ${Math.min(remainingOriginalPath.length, 5)} pontos futuros para reconexão...`);
            
            // Tentar reconectar a pontos futuros do caminho original
            for (let i = 0; i < Math.min(remainingOriginalPath.length, 5); i++) {
                const reconnectionPoint = remainingOriginalPath[i];
                const detourPath = findPath(currentPos, reconnectionPoint, gameState.obstacles.concat(gameState.dynamicObstacles));
                
                if (detourPath.length > 0) {
                    addLogEntry('pathfinding', `  ✅ Opção ${i+1}: Desvio de ${detourPath.length} passos até <span class="log-coordinates">(${reconnectionPoint[0]},${reconnectionPoint[1]})</span>`);
                    
                    if (detourPath.length < shortestDetour) {
                        bestReconnectionPath = detourPath;
                        bestReconnectionIndex = currentWalkStep + 1 + i;
                        shortestDetour = detourPath.length;
                    }
                } else {
                    addLogEntry('pathfinding', `  ❌ Opção ${i+1}: Sem caminho para <span class="log-coordinates">(${reconnectionPoint[0]},${reconnectionPoint[1]})</span>`);
                }
            }
            
            let newPath;
            if (bestReconnectionPath && bestReconnectionIndex !== -1) {
                // SUCESSO: Reconectou ao caminho original
                const completedPath = gameState.currentPath.slice(0, currentWalkStep);
                const reconnectedPath = gameState.currentPath.slice(bestReconnectionIndex);
                newPath = completedPath.concat(bestReconnectionPath.slice(1)).concat(reconnectedPath);
                gameState.currentPath = newPath;
                
                const reconnectionPoint = bestReconnectionPath[bestReconnectionPath.length - 1];
                const stepsToReconnect = bestReconnectionPath.length - 1;
                const stepsPreserved = reconnectedPath.length;
                
                addLogEntry('success', `🎯 DECISÃO: Desvio inteligente escolhido!`);
                addLogEntry('pathfinding', `🔄 Fazendo desvio de ${stepsToReconnect} passos para reconectar em <span class="log-coordinates">(${reconnectionPoint[0]},${reconnectionPoint[1]})</span>`);
                addLogEntry('pathfinding', `💾 Preservando ${stepsPreserved} passos do caminho original do usuário`);
                addLogEntry('pathfinding', `🗺️ Desvio: ${bestReconnectionPath.slice(1).map(p => `(${p[0]},${p[1]})`).join(' → ')}`);
            } else {
                // FALLBACK: Calcular nova rota para o destino
                addLogEntry('system', `🤔 Nenhuma reconexão viável encontrada...`);
                newPath = findPath(currentPos, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
                
                if (newPath.length > 0) {
                    const completedPath = gameState.currentPath.slice(0, currentWalkStep);
                    gameState.currentPath = completedPath.concat(newPath.slice(1));
                    
                    addLogEntry('pathfinding', `⚠️ DECISÃO: Nova rota direta para o destino`);
                    addLogEntry('system', `😔 Infelizmente, perdemos o resto do caminho desenhado pelo usuário`);
                    addLogEntry('pathfinding', `🗺️ Nova rota: ${newPath.slice(1).map(p => `(${p[0]},${p[1]})`).join(' → ')}`);
                } else {
                    addLogEntry('error', `🚫 Nenhum caminho alternativo encontrado de <span class="log-coordinates">(${currentPos[0]},${currentPos[1]})</span>! Missão falhou.`);
                    stopWalking();
                    return;
                }
            }
            
            gameState.stats.pathLength = gameState.currentPath.length;
            addLogEntry('pathfinding', `✨ Continuando de <span class="log-coordinates">(${currentPos[0]},${currentPos[1]})</span>`);
            
            // Continuar caminhada do ponto atual
            walkNextStep();
        }, 1000);
        return;
    }
    
    // Validar se o movimento é permitido (células adjacentes)
    if (currentWalkStep > 0) {
        const currentPos = gameState.currentPath[currentWalkStep - 1];
        const distance = Math.abs(nextPos[0] - currentPos[0]) + Math.abs(nextPos[1] - currentPos[1]);
        const isDiagonal = Math.abs(nextPos[0] - currentPos[0]) === 1 && Math.abs(nextPos[1] - currentPos[1]) === 1;
        
        if (distance > 2 || (distance === 2 && !isDiagonal)) {
            addLogEntry('error', `🚫 MOVIMENTO INVÁLIDO! Tentativa de pular de <span class="log-coordinates">(${currentPos[0]},${currentPos[1]})</span> para <span class="log-coordinates">(${nextPos[0]},${nextPos[1]})</span>`);
            addLogEntry('system', '🔧 Recalculando caminho devido a erro de pathfinding...');
            
            // Forçar recálculo do caminho DA POSIÇÃO ATUAL
            setTimeout(() => {
                gameState.stats.replanningCount++;
                const newPath = findPath(currentPos, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
                
                if (newPath.length > 0) {
                    const completedPath = gameState.currentPath.slice(0, currentWalkStep);
                    gameState.currentPath = completedPath.concat(newPath.slice(1));
                    gameState.stats.pathLength = gameState.currentPath.length;
                    walkNextStep();
                } else {
                    addLogEntry('error', '🚫 Impossível continuar - sem caminho válido!');
                    stopWalking();
                }
            }, 1000);
            return;
        }
    }
    
    moveCharacterToCell(nextPos[0], nextPos[1], () => {
        currentWalkStep++;
        addLogEntry('movement', `Passo ${currentWalkStep}/${gameState.currentPath.length} - Posição atual: <span class="log-coordinates">(${nextPos[0]},${nextPos[1]})</span>`);
        
        // Verificar se voltou ao caminho original (detecção simples)
        if (gameState.customPath.some(p => p[0] === nextPos[0] && p[1] === nextPos[1]) && 
            !gameState.visitedCells.some(p => p[0] === nextPos[0] && p[1] === nextPos[1])) {
            addLogEntry('success', `🎉 Reconectou ao caminho original! Voltando à rota desenhada pelo usuário`);
        }
        
        if (isWalking) {
            walkingInterval = setTimeout(walkNextStep, walkingSpeed);
        }
    });
}

function stopWalking() {
    if (isWalking) {
        addLogEntry('system', '⏹️ Caminhada interrompida pelo usuário');
    }
    
    isWalking = false;
    if (walkingInterval) {
        clearTimeout(walkingInterval);
        walkingInterval = null;
    }
    document.getElementById('walk-btn').textContent = '🚶 Iniciar Caminhada';
}

// Sistema de Log
function addLogEntry(type, message) {
    const logContainer = document.getElementById('log-container');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const currentTime = new Date();
    const timeString = currentTime.toLocaleTimeString('pt-BR', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    logEntry.innerHTML = `
        <span class="log-time">${timeString}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    
    // Auto-scroll para o final se ativado
    if (autoScroll) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // Limitar número de entradas (manter últimas 100)
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 100) {
        entries[0].remove();
    }
}

function clearLog() {
    const logContainer = document.getElementById('log-container');
    logContainer.innerHTML = '';
    addLogEntry('system', 'Log limpo - Sistema reiniciado');
}

function toggleAutoScroll() {
    autoScroll = !autoScroll;
    const btn = document.getElementById('auto-scroll-btn');
    btn.textContent = `📜 Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
}

function handleCellClick(row, col) {
    if ((row === gameState.start[0] && col === gameState.start[1]) ||
        (row === gameState.goal[0] && col === gameState.goal[1])) {
        return; // Não permite modificar início/fim
    }
    
    // NÃO parar caminhada - deixar o algoritmo adaptativo funcionar!
    // Se o robô estiver caminhando, ele vai detectar o obstáculo e recalcular
    
    const isObstacle = gameState.obstacles.some(obs => obs[0] === row && obs[1] === col);
    const isDynamicObstacle = gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col);
    
    if (isObstacle) {
        // Remove obstáculo estático
        gameState.obstacles = gameState.obstacles.filter(obs => !(obs[0] === row && obs[1] === col));
        addLogEntry('system', `Obstáculo removido de <span class="log-coordinates">(${row},${col})</span>`);
    } else if (isDynamicObstacle) {
        // Remove obstáculo dinâmico
        gameState.dynamicObstacles = gameState.dynamicObstacles.filter(obs => !(obs[0] === row && obs[1] === col));
        gameState.stats.dynamicObstacles--;
        addLogEntry('system', `Pokémon removido de <span class="log-coordinates">(${row},${col})</span>`);
    } else {
        // Adiciona obstáculo dinâmico
        gameState.dynamicObstacles.push([row, col]);
        gameState.stats.dynamicObstacles++;
        gameState.stats.replanningCount++;
        addLogEntry('obstacle', `🐛 Pokémon apareceu em <span class="log-coordinates">(${row},${col})</span>!`);
        
        // Se o robô estiver caminhando, ele vai detectar o obstáculo automaticamente
        if (isWalking) {
            addLogEntry('system', '🎯 Robô detectará o obstáculo no próximo movimento...');
        }
    }
    
    // SEMPRE atualizar o visual, independente se está caminhando ou não
    if (isWalking) {
        // Durante caminhada: apenas atualizar visual
        updateGridVisually();
        updateStats();
    } else {
        // Parado: recalcular caminho baseado no modo
        if (currentMode === 'interactive') {
            calculateAndShowPath();
        } else if (currentMode === 'custom') {
            updateGridVisually(); // No modo desenhar, apenas atualizar visual
            updateStats();
        } else {
            calculateAndShowPath(); // Demo mode
        }
    }
}

function calculateAndShowPath() {
    // Simulação simplificada do A*
    const path = findPath(gameState.start, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
    gameState.currentPath = path;
    gameState.stats.pathLength = path.length;
    gameState.stats.cellsProcessed += path.length;
    
    createGrid();
}

function findPath(start, goal, obstacles) {
    // Implementação corrigida do A* que não permite saltos impossíveis
    const openSet = [];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    // Função para converter posição em string para usar como chave
    const posKey = (pos) => `${pos[0]},${pos[1]}`;
    
    // Função heurística (distância Manhattan)
    const heuristic = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    
    // Função para obter vizinhos válidos (apenas células adjacentes)
    const getNeighbors = (pos) => {
        const neighbors = [];
        const [row, col] = pos;
        
        // 8 direções possíveis (incluindo diagonais)
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            // Verificar se está dentro dos limites
            if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
                // Verificar se não é obstáculo
                if (!obstacles.some(obs => obs[0] === newRow && obs[1] === newCol)) {
                    neighbors.push([newRow, newCol]);
                }
            }
        }
        
        return neighbors;
    };
    
    // Inicializar
    const startKey = posKey(start);
    const goalKey = posKey(goal);
    
    openSet.push({pos: start, f: heuristic(start, goal)});
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(start, goal));
    
    while (openSet.length > 0) {
        // Ordenar por f-score e pegar o melhor
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const currentKey = posKey(current.pos);
        
        // Chegou no objetivo
        if (currentKey === goalKey) {
            const path = [];
            let temp = current.pos;
            let tempKey = posKey(temp);
            
            while (cameFrom.has(tempKey)) {
                path.unshift(temp);
                temp = cameFrom.get(tempKey);
                tempKey = posKey(temp);
            }
            path.unshift(start);
            
            return path;
        }
        
        closedSet.add(currentKey);
        
        // Examinar vizinhos
        for (const neighbor of getNeighbors(current.pos)) {
            const neighborKey = posKey(neighbor);
            
            if (closedSet.has(neighborKey)) {
                continue;
            }
            
            // Calcular custo do movimento (diagonal = 1.4, ortogonal = 1.0)
            const moveCost = (Math.abs(neighbor[0] - current.pos[0]) + Math.abs(neighbor[1] - current.pos[1])) === 2 ? 1.4 : 1.0;
            const tentativeGScore = gScore.get(currentKey) + moveCost;
            
            if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                cameFrom.set(neighborKey, current.pos);
                gScore.set(neighborKey, tentativeGScore);
                const fScoreValue = tentativeGScore + heuristic(neighbor, goal);
                fScore.set(neighborKey, fScoreValue);
                
                // Adicionar à lista aberta se não estiver lá
                if (!openSet.some(item => posKey(item.pos) === neighborKey)) {
                    openSet.push({pos: neighbor, f: fScoreValue});
                }
            }
        }
    }
    
    // Não encontrou caminho
    return [];
}

function addRandomObstacle() {
    let attempts = 0;
    while (attempts < 20) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        
        if ((row !== gameState.start[0] || col !== gameState.start[1]) &&
            (row !== gameState.goal[0] || col !== gameState.goal[1]) &&
            !gameState.obstacles.some(obs => obs[0] === row && obs[1] === col) &&
            !gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
            
            gameState.obstacles.push([row, col]);
            
            addLogEntry('obstacle', `🎲 Obstáculo aleatório criado em <span class="log-coordinates">(${row},${col})</span>`);
            
            // SEMPRE atualizar visual
            if (isWalking) {
                updateGridVisually();
                updateStats();
                addLogEntry('system', '🎯 Robô detectará o obstáculo no próximo movimento...');
            } else {
                if (currentMode === 'interactive') {
                    calculateAndShowPath();
                } else if (currentMode === 'custom') {
                    updateGridVisually(); // Atualizar visual no modo desenhar
                } else {
                    createGrid(demoSteps[currentStepIndex]);
                }
            }
            break;
        }
        attempts++;
    }
}

function addRandomPokemon() {
    let attempts = 0;
    while (attempts < 20) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        
        if ((row !== gameState.start[0] || col !== gameState.start[1]) &&
            (row !== gameState.goal[0] || col !== gameState.goal[1]) &&
            !gameState.obstacles.some(obs => obs[0] === row && obs[1] === col) &&
            !gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
            
            gameState.dynamicObstacles.push([row, col]);
            gameState.stats.dynamicObstacles++;
            gameState.stats.replanningCount++;
            
            addLogEntry('obstacle', `🐛 Pokémon aleatório apareceu em <span class="log-coordinates">(${row},${col})</span>`);
            
            // SEMPRE atualizar visual
            if (isWalking) {
                updateGridVisually();
                updateStats();
                addLogEntry('system', '🎯 Robô detectará o pokémon no próximo movimento...');
            } else {
                if (currentMode === 'interactive') {
                    calculateAndShowPath();
                } else if (currentMode === 'custom') {
                    updateGridVisually(); // Atualizar visual no modo desenhar
                    updateStats(); // Atualizar estatísticas
                } else {
                    createGrid(demoSteps[currentStepIndex]);
                }
            }
            break;
        }
        attempts++;
    }
}

function clearFootprints() {
    gameState.visitedCells = [];
    gameState.steppedCells = [];
    gameState.detourCells = [];
    gameState.isOnDetour = false;
    
    addLogEntry('system', '👣 Pegadas do robô limpas');
    
    if (isWalking) {
        updateGridVisually();
    } else {
        if (currentMode === 'interactive') {
            calculateAndShowPath();
        } else if (currentMode === 'custom') {
            updateGridVisually();
        } else {
            createGrid(demoSteps[currentStepIndex]);
        }
    }
}

// === SISTEMA DE DESENHO DE CAMINHO PERSONALIZADO ===

function enablePathDrawing() {
    isDrawingPath = false;
    addLogEntry('system', '🎨 Modo de desenho ativado! Clique "Iniciar Desenho" para começar.');
    createGrid(); // Recriar grid no modo desenho
}

function disablePathDrawing() {
    isDrawingPath = false;
    isMouseDown = false;
}

function togglePathDrawing() {
    isDrawingPath = !isDrawingPath;
    const btn = document.getElementById('draw-toggle-btn');
    
    if (isDrawingPath) {
        btn.textContent = '🛑 Parar Desenho';
        btn.className = 'danger';
        addLogEntry('system', '✏️ Desenho ativado! Clique e arraste para desenhar o caminho.');
    } else {
        btn.textContent = '✏️ Iniciar Desenho';
        btn.className = 'success';
        addLogEntry('system', '🛑 Desenho desativado.');
    }
}

function handlePathDrawingStart(row, col, event) {
    if (!isDrawingPath) return;
    
    event.preventDefault();
    isMouseDown = true;
    
    // Não desenhar em obstáculos ou início/fim
    if ((row === gameState.start[0] && col === gameState.start[1]) ||
        (row === gameState.goal[0] && col === gameState.goal[1]) ||
        gameState.obstacles.some(obs => obs[0] === row && obs[1] === col) ||
        gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
        return;
    }
    
    // Adicionar ao caminho personalizado
    if (!gameState.customPath.some(p => p[0] === row && p[1] === col)) {
        gameState.customPath.push([row, col]);
        addLogEntry('system', `✏️ Adicionado ao caminho: <span class="log-coordinates">(${row},${col})</span>`);
        updateGridVisually();
    }
}

function handlePathDrawingMove(row, col) {
    if (!isDrawingPath || !isMouseDown) return;
    
    // Não desenhar em obstáculos ou início/fim
    if ((row === gameState.start[0] && col === gameState.start[1]) ||
        (row === gameState.goal[0] && col === gameState.goal[1]) ||
        gameState.obstacles.some(obs => obs[0] === row && obs[1] === col) ||
        gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
        return;
    }
    
    // Adicionar ao caminho personalizado se não existir
    if (!gameState.customPath.some(p => p[0] === row && p[1] === col)) {
        gameState.customPath.push([row, col]);
        updateGridVisually();
    }
}

function handlePathDrawingEnd(row, col) {
    if (!isDrawingPath) return;
    isMouseDown = false;
}

function addWaypoint() {
    addLogEntry('system', '⭐ Modo Waypoint ativado! Clique nas células para definir pontos obrigatórios.');
    
    // Temporariamente ativar modo waypoint
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const originalClick = cell.onclick;
        cell.onclick = function(e) {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            // Não permitir waypoint em obstáculos
            if (gameState.obstacles.some(obs => obs[0] === row && obs[1] === col) ||
                gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
                return;
            }
            
            // Toggle waypoint
            const existingIndex = gameState.waypoints.findIndex(w => w[0] === row && w[1] === col);
            if (existingIndex >= 0) {
                gameState.waypoints.splice(existingIndex, 1);
                addLogEntry('system', `⭐ Waypoint removido de <span class="log-coordinates">(${row},${col})</span>`);
            } else {
                gameState.waypoints.push([row, col]);
                addLogEntry('system', `⭐ Waypoint adicionado em <span class="log-coordinates">(${row},${col})</span>`);
            }
            
            updateGridVisually();
            
            // Restaurar click original depois de um tempo
            setTimeout(() => {
                cell.onclick = originalClick;
            }, 100);
        };
    });
}

function clearCustomPath() {
    gameState.customPath = [];
    gameState.waypoints = [];
    gameState.currentPath = []; // Limpar caminho atual também
    gameState.visitedCells = []; // Limpar células visitadas
    gameState.steppedCells = []; // Limpar pegadas
    gameState.detourCells = []; // Limpar desvios
    
    addLogEntry('system', '🗑️ Desenho, waypoints e caminhos anteriores apagados');
    
    // Forçar recriação completa do grid no modo desenhar
    if (currentMode === 'custom') {
        createGrid();
    } else {
        updateGridVisually();
    }
}

function followCustomPath() {
    if (gameState.customPath.length === 0 && gameState.waypoints.length === 0) {
        addLogEntry('error', '❌ Nenhum caminho desenhado! Desenhe um caminho primeiro.');
        alert('Desenhe um caminho primeiro usando "Iniciar Desenho" ou "Modo Waypoint"!');
        return;
    }
    
    // Parar caminhada se estiver ativa
    if (isWalking) {
        stopWalking();
    }
    
    // Criar caminho baseado no desenho do usuário
    let finalPath = [];
    
    if (gameState.waypoints.length > 0) {
        // WAYPOINTS: Usar A* para conectar os pontos
        addLogEntry('pathfinding', `⭐ Processando ${gameState.waypoints.length} waypoints...`);
        
        let currentPos = gameState.start;
        finalPath.push(currentPos);
        
        for (let i = 0; i < gameState.waypoints.length; i++) {
            const waypoint = gameState.waypoints[i];
            const pathSegment = findPath(currentPos, waypoint, gameState.obstacles.concat(gameState.dynamicObstacles));
            
            if (pathSegment.length > 0) {
                finalPath = finalPath.concat(pathSegment.slice(1));
                currentPos = waypoint;
                addLogEntry('pathfinding', `✅ Waypoint ${i+1} conectado: <span class="log-coordinates">(${waypoint[0]},${waypoint[1]})</span>`);
            } else {
                addLogEntry('error', `❌ Não foi possível conectar ao waypoint <span class="log-coordinates">(${waypoint[0]},${waypoint[1]})</span>`);
            }
        }
        
        const finalSegment = findPath(currentPos, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
        if (finalSegment.length > 0) {
            finalPath = finalPath.concat(finalSegment.slice(1));
            addLogEntry('pathfinding', `🎯 Caminho final para destino conectado`);
        }
        
    } else if (gameState.customPath.length > 0) {
        // DESENHO LIVRE: Usar EXATAMENTE o caminho desenhado
        addLogEntry('pathfinding', `✏️ Seguindo caminho desenhado EXATAMENTE como foi feito...`);
        
        // Conectar início ao primeiro ponto do desenho com A*
        const firstPoint = gameState.customPath[0];
        const startSegment = findPath(gameState.start, firstPoint, gameState.obstacles.concat(gameState.dynamicObstacles));
        
        if (startSegment.length > 0) {
            finalPath = startSegment;
            addLogEntry('pathfinding', `🔗 Conectado início <span class="log-coordinates">(${gameState.start[0]},${gameState.start[1]})</span> ao primeiro desenho <span class="log-coordinates">(${firstPoint[0]},${firstPoint[1]})</span>`);
        } else {
            addLogEntry('error', '❌ Não foi possível conectar ao início do caminho desenhado');
            return;
        }
        
        // Adicionar EXATAMENTE os pontos desenhados na ORDEM ORIGINAL
        for (let i = 1; i < gameState.customPath.length; i++) {
            const currentPoint = gameState.customPath[i];
            const previousPoint = gameState.customPath[i-1];
            
            // Verificar se o movimento é válido (células adjacentes)
            const distance = Math.abs(currentPoint[0] - previousPoint[0]) + Math.abs(currentPoint[1] - previousPoint[1]);
            const isDiagonal = Math.abs(currentPoint[0] - previousPoint[0]) === 1 && Math.abs(currentPoint[1] - previousPoint[1]) === 1;
            
            if (distance <= 2 && (distance <= 1 || isDiagonal)) {
                // Movimento válido - adicionar diretamente
                finalPath.push(currentPoint);
            } else {
                // Movimento inválido - usar A* para conectar estes dois pontos
                addLogEntry('pathfinding', `🔗 Conectando <span class="log-coordinates">(${previousPoint[0]},${previousPoint[1]})</span> → <span class="log-coordinates">(${currentPoint[0]},${currentPoint[1]})</span> com A*`);
                const connectionSegment = findPath(previousPoint, currentPoint, gameState.obstacles.concat(gameState.dynamicObstacles));
                
                if (connectionSegment.length > 0) {
                    finalPath = finalPath.concat(connectionSegment.slice(1)); // Remove duplicata
                } else {
                    addLogEntry('error', `❌ Não foi possível conectar pontos do desenho`);
                    finalPath.push(currentPoint); // Adicionar mesmo assim
                }
            }
        }
        
        // Conectar último ponto ao destino com A*
        const lastPoint = gameState.customPath[gameState.customPath.length - 1];
        if (lastPoint[0] !== gameState.goal[0] || lastPoint[1] !== gameState.goal[1]) {
            const endSegment = findPath(lastPoint, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
            
            if (endSegment.length > 0) {
                finalPath = finalPath.concat(endSegment.slice(1));
                addLogEntry('pathfinding', `🎯 Conectado último desenho <span class="log-coordinates">(${lastPoint[0]},${lastPoint[1]})</span> ao destino <span class="log-coordinates">(${gameState.goal[0]},${gameState.goal[1]})</span>`);
            }
        }
    }
    
    // Validar caminho final
    if (finalPath.length === 0) {
        addLogEntry('error', '❌ Não foi possível criar caminho válido');
        return;
    }
    
    // VALIDAÇÃO FINAL: Verificar se não há saltos impossíveis
    const validatedPath = [];
    validatedPath.push(finalPath[0]);
    
    for (let i = 1; i < finalPath.length; i++) {
        const current = finalPath[i];
        const previous = finalPath[i-1];
        
        const distance = Math.abs(current[0] - previous[0]) + Math.abs(current[1] - previous[1]);
        const isDiagonal = Math.abs(current[0] - previous[0]) === 1 && Math.abs(current[1] - previous[1]) === 1;
        
        if (distance <= 2 && (distance <= 1 || isDiagonal)) {
            validatedPath.push(current);
        } else {
            // Salto inválido detectado - usar A* para corrigir
            addLogEntry('error', `🚫 Salto inválido detectado: <span class="log-coordinates">(${previous[0]},${previous[1]})</span> → <span class="log-coordinates">(${current[0]},${current[1]})</span>`);
            const fixSegment = findPath(previous, current, gameState.obstacles.concat(gameState.dynamicObstacles));
            
            if (fixSegment.length > 0) {
                validatedPath.push(...fixSegment.slice(1));
            } else {
                validatedPath.push(current); // Fallback
            }
        }
    }
    
    // Aplicar o caminho validado
    gameState.currentPath = validatedPath;
    gameState.stats.pathLength = validatedPath.length;
    
    addLogEntry('success', `🚀 Caminho personalizado criado com ${validatedPath.length} passos!`);
    addLogEntry('pathfinding', `🗺️ Rota: ${validatedPath.slice(0, 10).map(p => `(${p[0]},${p[1]})`).join(' → ')}${validatedPath.length > 10 ? '...' : ''}`);
    
    // Atualizar visual
    updateGridVisually();
    
    // Iniciar caminhada automaticamente
    setTimeout(() => {
        startWalking();
    }, 1000);
}

function clearObstacles() {
    gameState.dynamicObstacles = [];
    gameState.stats.dynamicObstacles = 0;
    
    if (currentMode === 'interactive') {
        calculateAndShowPath();
    } else {
        createGrid(demoSteps[currentStepIndex]);
    }
}

function nextStep() {
    if (currentStepIndex < demoSteps.length - 1) {
        currentStepIndex++;
        createGrid(demoSteps[currentStepIndex]);
    }
}

function resetDemo() {
    currentStepIndex = 0;
    stopWalking(); // Para qualquer caminhada em andamento
    
    gameState.stats = {
        cellsProcessed: 0,
        dynamicObstacles: 0,
        replanningCount: 0,
        pathLength: 0
    };
    
    // Limpar rastros visuais
    gameState.visitedCells = [];
    gameState.steppedCells = [];
    gameState.detourCells = [];
    gameState.customPath = [];
    gameState.waypoints = [];
    gameState.isOnDetour = false;
    
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
    
    if (currentMode === 'demo') {
        createGrid(demoSteps[0]);
    } else {
        calculateAndShowPath();
    }
}

function autoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
        document.getElementById('auto-btn').textContent = '⏯️ Auto Play';
        return;
    }
    
    document.getElementById('auto-btn').textContent = '⏸️ Pausar';
    autoPlayInterval = setInterval(() => {
        if (currentStepIndex < demoSteps.length - 1) {
            nextStep();
        } else {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
            document.getElementById('auto-btn').textContent = '⏯️ Auto Play';
        }
    }, playbackSpeed);
}

// Inicialização
window.addEventListener('load', function() {
    createGrid(demoSteps[0]);
    
    // Adicionar eventos globais do mouse para desenho
    document.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
});