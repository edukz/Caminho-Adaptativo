let GRID_SIZE = 10;
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
let educationalAutoScroll = true;
let startTime = Date.now();
let isDrawingPath = false;
let isMouseDown = false;
let movingObstaclesInterval = null;
let finalApproach = false;
let spawnInterval = null;
let educationalMode = true; // Modo educacional ativado por padrão

// Função auxiliar para obter dimensões do grid atual
function getGridDimensions() {
    let cellSize, gap;
    
    // SOLUÇÃO SIMPLES: Tamanhos fixos mas responsivos
    switch(GRID_SIZE) {
        case 8:
            cellSize = 60;
            gap = 3;
            break;
        case 10:
            cellSize = 50;
            gap = 3;
            break;
        default:
            cellSize = 50;
            gap = 3;
    }
    
    console.log(`Grid ${GRID_SIZE}x${GRID_SIZE}: cellSize=${cellSize}px, gap=${gap}px`);
    
    return {
        cellSize,
        gap,
        totalCellSize: cellSize + gap,
        characterSize: Math.max(25, cellSize * 0.75),
        gridPadding: 20
    };
}

// Configurações Avançadas
let advancedConfig = {
    gridSize: 10,
    movementType: 8, // 8-direções ou 4-direções
    obstacleSpeed: 3000, // velocidade em ms
    spawnFrequency: 0, // 0 = desabilitado, >0 = intervalo em ms
    replanLimit: 5, // limite de recálculos
    showCoordinates: true,
    highlightOriginal: false
};
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
    movingObstacles: [], // Obstáculos que se movem
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
    // Animação de transição suave
    const container = document.querySelector('.simulation-area');
    container.style.opacity = '0.5';
    container.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.transform = 'scale(1)';
        });
        document.getElementById(mode + '-btn').classList.add('active');
        document.getElementById(mode + '-btn').style.transform = 'scale(1.05)';
        
        // Controlar visibilidade dos controles baseado no modo
        const mainControls = document.getElementById('main-controls');
        const speedControls = document.getElementById('speed-controls');
        const drawingControls = document.getElementById('drawing-controls');
        
        // Parar obstáculos móveis e auto-spawn se estiverem ativos
        stopMovingObstacles();
        stopAutoSpawn();
        
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
                startMovingObstacles(); // Iniciar obstáculos móveis
                if (advancedConfig.spawnFrequency > 0) {
                    startAutoSpawn(); // Iniciar auto-spawn se configurado
                }
            } else {
                resetDemo();
            }
        }
        
        // Restaurar animação
        container.style.opacity = '1';
        container.style.transform = 'scale(1)';
        
        setTimeout(() => {
            document.getElementById(mode + '-btn').style.transform = 'scale(1)';
        }, 200);
    }, 150);
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
    // Remover personagem existente
    if (character) {
        character.remove();
        character = null;
    }
    
    // Validar posição inicial
    if (gameState.start[0] >= GRID_SIZE || gameState.start[1] >= GRID_SIZE || 
        gameState.start[0] < 0 || gameState.start[1] < 0) {
        gameState.start = [0, 0];
        addLogEntry('system', '⚠️ Posição inicial corrigida para (0,0)');
    }
    
    character = document.createElement('div');
    character.className = 'character';
    character.id = 'walking-character';
    
    // Verificar se a célula inicial existe
    const startCell = document.getElementById(`cell-${gameState.start[0]}-${gameState.start[1]}`);
    if (!startCell) {
        addLogEntry('error', `❌ Célula inicial (${gameState.start[0]},${gameState.start[1]}) não encontrada!`);
        // Forçar posição (0,0)
        gameState.start = [0, 0];
    }
    
    const dims = getGridDimensions();
    const grid = document.getElementById('grid');
    
    if (grid) {
        const left = gameState.start[1] * dims.totalCellSize + dims.gridPadding + (dims.cellSize / 2) - (dims.characterSize / 2);
        const top = gameState.start[0] * dims.totalCellSize + dims.gridPadding + (dims.cellSize / 2) - (dims.characterSize / 2);
        
        character.style.position = 'absolute';
        character.style.left = left + 'px';
        character.style.top = top + 'px';
        character.style.width = dims.characterSize + 'px';
        character.style.height = dims.characterSize + 'px';
        character.style.zIndex = '1000';
        character.style.pointerEvents = 'none';
        
        grid.style.position = 'relative';
        grid.appendChild(character);
        
        // Log da criação do personagem
        addLogEntry('success', `🤖 Robô criado em (${gameState.start[0]},${gameState.start[1]}) - Tamanho: ${dims.characterSize}px`);
        console.log(`Personagem criado na posição: left=${left}px, top=${top}px`);
    } else {
        addLogEntry('error', '❌ Grid não encontrado! Não foi possível criar o robô.');
    }
}

function moveCharacterToCell(row, col, callback = null) {
    if (!character) return;
    
    // VALIDAÇÃO CRÍTICA: Verificar se posição está dentro dos limites
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        addLogEntry('error', `🚫 MOVIMENTO INVÁLIDO! Tentativa de mover para (${row},${col}) - Grid é ${GRID_SIZE}x${GRID_SIZE}`);
        if (callback) callback();
        return;
    }
    
    const targetCell = document.getElementById(`cell-${row}-${col}`);
    if (!targetCell) {
        addLogEntry('error', `🚫 Célula (${row},${col}) não existe no DOM!`);
        if (callback) callback();
        return;
    }
    
    // MARCAR A CÉLULA COMO PISADA IMEDIATAMENTE
    if (!gameState.steppedCells.some(p => p[0] === row && p[1] === col)) {
        gameState.steppedCells.push([row, col]);
        addLogEntry('movement', `👣 Pisou em <span class="log-coordinates">(${row},${col})</span>`);
        
        // Verificar se é um desvio (não estava no caminho original)
        if (gameState.originalPath.length > 0 && 
            !gameState.originalPath.some(p => p[0] === row && p[1] === col) &&
            !gameState.customPath.some(p => p[0] === row && p[1] === col)) {
            gameState.detourCells.push([row, col]);
            addLogEntry('detour', `🔄 Desvio detectado em <span class="log-coordinates">(${row},${col})</span>!`);
        }
        
        // Atualizar visual imediatamente
        updateGridVisually();
    }
    
    // Log do movimento
    addLogEntry('movement', `Movendo para <span class="log-coordinates">(${row},${col})</span>`);
    
    // Calcular nova posição baseada na posição real da célula no DOM
    const targetCellRect = targetCell.getBoundingClientRect();
    const gridRect = targetCell.parentElement.getBoundingClientRect();
    
    // Posição relativa à grid container
    const cellLeft = targetCellRect.left - gridRect.left;
    const cellTop = targetCellRect.top - gridRect.top;
    
    const dims = getGridDimensions();
    
    // Centralizar o robô na célula usando as dimensões reais
    const newLeft = cellLeft + (targetCellRect.width / 2) - (dims.characterSize / 2);
    const newTop = cellTop + (targetCellRect.height / 2) - (dims.characterSize / 2);
    
    console.log(`🎯 Movendo robô para (${row},${col})`);
    console.log(`   Célula: ${targetCellRect.width}x${targetCellRect.height} em ${cellLeft},${cellTop}`);
    console.log(`   Robô: ${dims.characterSize}x${dims.characterSize} -> ${newLeft}px, ${newTop}px`);
    
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
    finalApproach = false;
    
    // Salvar o caminho original para detectar desvios
    gameState.originalPath = [...path];
    
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
        
        // Efeito de brilho quando está chegando ao final
        const distanceToGoal = Math.abs(nextPos[0] - gameState.goal[0]) + Math.abs(nextPos[1] - gameState.goal[1]);
        if (distanceToGoal <= 3 && !finalApproach) {
            finalApproach = true;
            addLogEntry('success', '✨ Aproximação final! Adicionando efeito de brilho...');
            addFinalApproachGlow();
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
    finalApproach = false;
    if (walkingInterval) {
        clearTimeout(walkingInterval);
        walkingInterval = null;
    }
    document.getElementById('walk-btn').textContent = '🚶 Iniciar Caminhada';
    removeFinalApproachGlow();
}

// === SISTEMA DE OBSTÁCULOS MÓVEIS ===
function startMovingObstacles() {
    if (movingObstaclesInterval) return;
    
    // Criar alguns obstáculos móveis
    gameState.movingObstacles = [
        { pos: [3, 4], direction: [1, 0], speed: 3000 },
        { pos: [6, 6], direction: [0, 1], speed: 2500 },
        { pos: [8, 2], direction: [-1, 0], speed: 3500 }
    ];
    
    addLogEntry('system', '🔄 Obstáculos móveis ativados!');
    
    movingObstaclesInterval = setInterval(() => {
        moveObstacles();
    }, advancedConfig.obstacleSpeed);
}

function stopMovingObstacles() {
    if (movingObstaclesInterval) {
        clearInterval(movingObstaclesInterval);
        movingObstaclesInterval = null;
    }
    gameState.movingObstacles = [];
}

function moveObstacles() {
    if (currentMode !== 'interactive' || gameState.movingObstacles.length === 0) return;
    
    gameState.movingObstacles.forEach((obstacle, index) => {
        const [row, col] = obstacle.pos;
        const [dr, dc] = obstacle.direction;
        
        // Calcular nova posição
        let newRow = row + dr;
        let newCol = col + dc;
        
        // Verificar limites e mudar direção se necessário
        if (newRow < 0 || newRow >= GRID_SIZE || newCol < 0 || newCol >= GRID_SIZE ||
            gameState.obstacles.some(obs => obs[0] === newRow && obs[1] === newCol)) {
            // Mudar direção aleatoriamente
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            obstacle.direction = directions[Math.floor(Math.random() * directions.length)];
            newRow = row + obstacle.direction[0];
            newCol = col + obstacle.direction[1];
            
            // Se ainda inválido, ficar parado
            if (newRow < 0 || newRow >= GRID_SIZE || newCol < 0 || newCol >= GRID_SIZE ||
                gameState.obstacles.some(obs => obs[0] === newRow && obs[1] === newCol)) {
                return;
            }
        }
        
        // Remover obstáculo da posição antiga
        gameState.dynamicObstacles = gameState.dynamicObstacles.filter(obs => 
            !(obs[0] === row && obs[1] === col));
        
        // Adicionar na nova posição
        obstacle.pos = [newRow, newCol];
        if (!gameState.dynamicObstacles.some(obs => obs[0] === newRow && obs[1] === newCol)) {
            gameState.dynamicObstacles.push([newRow, newCol]);
        }
        
        addLogEntry('obstacle', `🔄 Pokémon se moveu de (${row},${col}) para (${newRow},${newCol})`);
    });
    
    // Atualizar visual
    updateGridVisually();
}

// === EFEITOS DE BRILHO FINAL ===
function addFinalApproachGlow() {
    const goalCell = document.getElementById(`cell-${gameState.goal[0]}-${gameState.goal[1]}`);
    if (goalCell) {
        goalCell.classList.add('final-glow');
        
        // Adicionar efeito de brilho nas células próximas ao destino
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const r = gameState.goal[0] + dr;
                const c = gameState.goal[1] + dc;
                if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
                    const cell = document.getElementById(`cell-${r}-${c}`);
                    if (cell && Math.abs(dr) + Math.abs(dc) <= 2) {
                        cell.classList.add('approach-glow');
                    }
                }
            }
        }
    }
}

function removeFinalApproachGlow() {
    document.querySelectorAll('.final-glow, .approach-glow').forEach(cell => {
        cell.classList.remove('final-glow', 'approach-glow');
    });
}


// Sistema de Log
function addLogEntry(type, message) {
    // Determinar qual container usar baseado no tipo
    let logContainer, useAutoScroll;
    
    if (type === 'learning') {
        logContainer = document.getElementById('educational-log-container');
        useAutoScroll = educationalAutoScroll;
    } else {
        logContainer = document.getElementById('system-log-container');
        useAutoScroll = autoScroll;
    }
    
    if (!logContainer) {
        console.log(`LOG [${type}]: ${message}`);
        return;
    }
    
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
    if (useAutoScroll) {
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // Limitar número de entradas (manter últimas 500 para cada log)
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 500) {
        // Remove as 50 entradas mais antigas de uma vez para melhor performance
        for (let i = 0; i < 50; i++) {
            if (entries[i]) {
                entries[i].remove();
            }
        }
    }
}

function clearSystemLog() {
    const logContainer = document.getElementById('system-log-container');
    const entriesCount = logContainer.querySelectorAll('.log-entry').length;
    logContainer.innerHTML = '';
    addLogEntry('system', `🗑️ Log do sistema limpo - ${entriesCount} entradas removidas.`);
}

function clearEducationalLog() {
    const logContainer = document.getElementById('educational-log-container');
    const entriesCount = logContainer.querySelectorAll('.log-entry').length;
    logContainer.innerHTML = '';
    addLogEntry('learning', `🗑️ Log educacional limpo - ${entriesCount} entradas removidas.`);
}

function toggleSystemAutoScroll() {
    autoScroll = !autoScroll;
    const btn = document.getElementById('system-auto-scroll-btn');
    btn.textContent = `📜 Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
}

function toggleEducationalAutoScroll() {
    educationalAutoScroll = !educationalAutoScroll;
    const btn = document.getElementById('educational-auto-scroll-btn');
    btn.textContent = `📜 Auto-scroll: ${educationalAutoScroll ? 'ON' : 'OFF'}`;
}

function toggleEducationalMode() {
    educationalMode = !educationalMode;
    const btn = document.getElementById('educational-mode-toggle');
    const mainBtn = document.getElementById('educational-mode-btn');
    
    if (btn) {
        btn.textContent = `🎓 ${educationalMode ? 'ON' : 'OFF'}`;
        btn.className = `log-btn secondary ${educationalMode ? 'active' : ''}`;
    }
    
    if (mainBtn) {
        mainBtn.textContent = `🎓 Modo Educacional: ${educationalMode ? 'ON' : 'OFF'}`;
        mainBtn.className = `secondary ${educationalMode ? 'active' : ''}`;
    }
    
    if (educationalMode) {
        addLogEntry('system', '🎓 Modo Educacional ATIVADO - O algoritmo A* explicará suas decisões');
        addLogEntry('learning', '🎓 Modo Educacional ATIVADO - Pronto para explicar decisões do A*!');
    } else {
        addLogEntry('system', '🎓 Modo Educacional DESATIVADO - Logs simplificados');
        addLogEntry('learning', '🎓 Modo Educacional DESATIVADO - Logs educacionais pausados.');
    }
}

function showLogStats() {
    const logContainer = document.getElementById('log-container');
    const entries = logContainer.querySelectorAll('.log-entry');
    
    // Contar entradas por tipo
    const stats = {
        system: 0,
        movement: 0,
        obstacle: 0,
        pathfinding: 0,
        success: 0,
        error: 0,
        detour: 0,
        total: entries.length
    };
    
    entries.forEach(entry => {
        if (entry.classList.contains('system')) stats.system++;
        else if (entry.classList.contains('movement')) stats.movement++;
        else if (entry.classList.contains('obstacle')) stats.obstacle++;
        else if (entry.classList.contains('pathfinding')) stats.pathfinding++;
        else if (entry.classList.contains('success')) stats.success++;
        else if (entry.classList.contains('error')) stats.error++;
        else if (entry.classList.contains('detour')) stats.detour++;
    });
    
    const percentage = ((stats.total / 1000) * 100).toFixed(1);
    
    addLogEntry('system', `📊 ESTATÍSTICAS DO LOG:`);
    addLogEntry('system', `   📝 Total de entradas: ${stats.total}/1000 (${percentage}%)`);
    addLogEntry('system', `   ⚙️ Sistema: ${stats.system} | 🚶 Movimento: ${stats.movement}`);
    addLogEntry('system', `   🧠 Pathfinding: ${stats.pathfinding} | 🎯 Sucesso: ${stats.success}`);
    addLogEntry('system', `   ⚠️ Obstáculos: ${stats.obstacle} | ❌ Erros: ${stats.error}`);
    addLogEntry('system', `   🔄 Desvios: ${stats.detour}`);
    
    if (stats.total > 800) {
        addLogEntry('system', `⚠️ Log quase cheio! ${1000 - stats.total} entradas restantes.`);
    }
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
    
    // Função para obter vizinhos válidos (baseado na configuração de movimento)
    const getNeighbors = (pos) => {
        const neighbors = [];
        const [row, col] = pos;
        
        // Direções baseadas na configuração
        let directions;
        if (advancedConfig.movementType === 8) {
            // 8 direções (incluindo diagonais)
            directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
        } else {
            // 4 direções (apenas ortogonais)
            directions = [
                [-1, 0],
                [0, -1], [0, 1],
                [1, 0]
            ];
        }
        
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
    
    // Log educacional: Iniciando algoritmo
    if (educationalMode) {
        addLogEntry('learning', `🎓 INICIANDO A*: De (${start[0]},${start[1]}) para (${goal[0]},${goal[1]})`);
        addLogEntry('learning', `📚 Heurística inicial: ${heuristic(start, goal)} (distância Manhattan)`);
    }
    
    openSet.push({pos: start, f: heuristic(start, goal)});
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(start, goal));
    
    let iteration = 0;
    
    while (openSet.length > 0) {
        iteration++;
        
        // Ordenar por f-score e pegar o melhor
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const currentKey = posKey(current.pos);
        
        // Log educacional: Célula atual sendo examinada
        if (educationalMode) {
            addLogEntry('learning', `🔍 Iteração ${iteration}: Examinando (${current.pos[0]},${current.pos[1]}) - F=${current.f.toFixed(1)}`);
        }
        
        // Chegou no objetivo
        if (currentKey === goalKey) {
            if (educationalMode) {
                addLogEntry('learning', `🎯 SUCESSO! Destino alcançado em ${iteration} iterações`);
            }
            
            const path = [];
            let temp = current.pos;
            let tempKey = posKey(temp);
            
            while (cameFrom.has(tempKey)) {
                path.unshift(temp);
                temp = cameFrom.get(tempKey);
                tempKey = posKey(temp);
            }
            path.unshift(start);
            
            if (educationalMode) {
                addLogEntry('learning', `🛤️ Caminho encontrado com ${path.length} células (custo ${gScore.get(goalKey).toFixed(1)})`);
            }
            return path;
        }
        
        closedSet.add(currentKey);
        
        // Examinar vizinhos
        const neighbors = getNeighbors(current.pos);
        if (educationalMode) {
            addLogEntry('learning', `👀 Analisando ${neighbors.length} vizinhos válidos...`);
        }
        
        for (const neighbor of neighbors) {
            const neighborKey = posKey(neighbor);
            
            if (closedSet.has(neighborKey)) {
                if (educationalMode) {
                    addLogEntry('learning', `❌ (${neighbor[0]},${neighbor[1]}) já foi visitada - ignorando`);
                }
                continue;
            }
            
            // Calcular custo do movimento (diagonal = 1.4, ortogonal = 1.0)
            const moveCost = (Math.abs(neighbor[0] - current.pos[0]) + Math.abs(neighbor[1] - current.pos[1])) === 2 ? 1.4 : 1.0;
            const tentativeGScore = gScore.get(currentKey) + moveCost;
            const heuristicValue = heuristic(neighbor, goal);
            
            if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                const isNewCell = !gScore.has(neighborKey);
                const oldGScore = gScore.get(neighborKey) || Infinity;
                
                cameFrom.set(neighborKey, current.pos);
                gScore.set(neighborKey, tentativeGScore);
                const fScoreValue = tentativeGScore + heuristicValue;
                fScore.set(neighborKey, fScoreValue);
                
                if (educationalMode) {
                    if (isNewCell) {
                        addLogEntry('learning', `✅ Nova célula (${neighbor[0]},${neighbor[1]}): G=${tentativeGScore.toFixed(1)} + H=${heuristicValue} = F=${fScoreValue.toFixed(1)}`);
                    } else {
                        addLogEntry('learning', `🔄 Caminho melhor para (${neighbor[0]},${neighbor[1]}): G=${oldGScore.toFixed(1)}→${tentativeGScore.toFixed(1)} (economia: ${(oldGScore - tentativeGScore).toFixed(1)})`);
                    }
                }
                
                // Adicionar à lista aberta se não estiver lá
                if (!openSet.some(item => posKey(item.pos) === neighborKey)) {
                    openSet.push({pos: neighbor, f: fScoreValue});
                }
            } else {
                if (educationalMode) {
                    addLogEntry('learning', `⚠️ (${neighbor[0]},${neighbor[1]}) já tem caminho melhor (G atual: ${gScore.get(neighborKey).toFixed(1)} < tentativa: ${tentativeGScore.toFixed(1)})`);
                }
            }
        }
        
        // Log do estado atual das listas
        if (educationalMode && iteration % 3 === 0) { // A cada 3 iterações para não poluir
            addLogEntry('learning', `📊 Estado: ${openSet.length} células em aberto, ${closedSet.size} células fechadas`);
        }
    }
    
    // Não encontrou caminho
    if (educationalMode) {
        addLogEntry('learning', `🚫 FALHA: Nenhum caminho encontrado após ${iteration} iterações`);
    }
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

// === GERADOR DE CENÁRIOS ALEATÓRIOS ===
function generateRandomScenario(difficulty) {
    // Parar caminhada se estiver ativa
    if (isWalking) {
        stopWalking();
    }
    
    // Limpar cenário atual
    clearCurrentScenario();
    
    let obstacleCount, pokemonCount, description;
    
    switch(difficulty) {
        case 'easy':
            obstacleCount = Math.floor(Math.random() * 8) + 5; // 5-12 obstáculos
            pokemonCount = Math.floor(Math.random() * 3) + 1; // 1-3 pokémon
            description = 'Cenário Fácil - Poucos obstáculos, caminho direto possível';
            break;
        case 'medium':
            obstacleCount = Math.floor(Math.random() * 12) + 10; // 10-21 obstáculos
            pokemonCount = Math.floor(Math.random() * 4) + 2; // 2-5 pokémon
            description = 'Cenário Médio - Obstáculos moderados, alguns desvios necessários';
            break;
        case 'hard':
            obstacleCount = Math.floor(Math.random() * 15) + 20; // 20-34 obstáculos
            pokemonCount = Math.floor(Math.random() * 6) + 3; // 3-8 pokémon
            description = 'Cenário Difícil - Muitos obstáculos, navegação complexa';
            break;
    }
    
    // Gerar obstáculos estáticos
    const attempts = obstacleCount * 3; // Múltiplas tentativas para evitar loops infinitos
    let placedObstacles = 0;
    
    for (let i = 0; i < attempts && placedObstacles < obstacleCount; i++) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        
        if (isValidObstaclePosition(row, col)) {
            gameState.obstacles.push([row, col]);
            placedObstacles++;
        }
    }
    
    // Gerar pokémon (obstáculos dinâmicos)
    let placedPokemon = 0;
    for (let i = 0; i < attempts && placedPokemon < pokemonCount; i++) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        
        if (isValidObstaclePosition(row, col)) {
            gameState.dynamicObstacles.push([row, col]);
            gameState.stats.dynamicObstacles++;
            placedPokemon++;
        }
    }
    
    // Logs informativos
    addLogEntry('system', `🎲 ${description}`);
    addLogEntry('system', `📊 Gerado: ${placedObstacles} obstáculos, ${placedPokemon} pokémon`);
    
    // Verificar se caminho é possível
    const testPath = findPath(gameState.start, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
    if (testPath.length === 0) {
        addLogEntry('error', '⚠️ Cenário impossível detectado! Removendo alguns obstáculos...');
        fixImpossibleScenario();
    } else {
        addLogEntry('success', `✅ Cenário válido! Caminho de ${testPath.length} passos encontrado`);
        
        // Calcular e mostrar caminho automaticamente
        gameState.currentPath = testPath;
        gameState.originalPath = [...testPath];
        gameState.stats.pathLength = testPath.length;
        
        addLogEntry('pathfinding', `🧠 Caminho calculado automaticamente: ${testPath.length} passos`);
        addLogEntry('system', `🚀 Pronto para iniciar! Clique em "🚶 Iniciar Caminhada" quando quiser`);
    }
    
    // Atualizar visual
    updateVisualAfterScenarioGeneration();
}

function generateMaze(type) {
    // Parar caminhada se estiver ativa
    if (isWalking) {
        stopWalking();
    }
    
    // Limpar cenário atual
    clearCurrentScenario();
    
    switch(type) {
        case 'spiral':
            generateSpiralMaze();
            break;
        case 'zigzag':
            generateZigZagMaze();
            break;
        case 'cross':
            generateCrossMaze();
            break;
        case 'chambers':
            generateChambersMaze();
            break;
    }
    
    // Adicionar alguns pokémon aleatórios
    addRandomPokemonToMaze(2, 4);
    
    // Calcular caminho automaticamente
    const mazePath = findPath(gameState.start, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
    if (mazePath.length === 0) {
        addLogEntry('error', '⚠️ Labirinto sem solução! Corrigindo...');
        fixImpossibleScenario();
    } else {
        gameState.currentPath = mazePath;
        gameState.originalPath = [...mazePath];
        gameState.stats.pathLength = mazePath.length;
        
        addLogEntry('pathfinding', `🧠 Caminho do labirinto calculado: ${mazePath.length} passos`);
        addLogEntry('success', `🏆 Labirinto ${type} pronto! Clique em "🚶 Iniciar Caminhada"`);
    }
    
    // Atualizar visual
    updateVisualAfterScenarioGeneration();
}

function generateSpiralMaze() {
    addLogEntry('system', '🌪️ Gerando labirinto em espiral...');
    
    // Criar espiral do centro para fora
    const center = Math.floor(GRID_SIZE / 2);
    let radius = 1;
    
    while (radius < center) {
        // Lado superior
        for (let col = center - radius; col <= center + radius; col++) {
            if (isValidObstaclePosition(center - radius, col)) {
                gameState.obstacles.push([center - radius, col]);
            }
        }
        
        // Lado direito
        for (let row = center - radius + 1; row <= center + radius; row++) {
            if (isValidObstaclePosition(row, center + radius)) {
                gameState.obstacles.push([row, center + radius]);
            }
        }
        
        // Lado inferior (se não for a mesma linha do topo)
        if (radius > 0) {
            for (let col = center + radius - 1; col >= center - radius; col--) {
                if (isValidObstaclePosition(center + radius, col)) {
                    gameState.obstacles.push([center + radius, col]);
                }
            }
        }
        
        // Lado esquerdo (se não for a mesma coluna da direita)
        if (radius > 0) {
            for (let row = center + radius - 1; row > center - radius; row--) {
                if (isValidObstaclePosition(row, center - radius)) {
                    gameState.obstacles.push([row, center - radius]);
                }
            }
        }
        
        radius += 2; // Pular uma linha para criar corredor
    }
    
    addLogEntry('success', `✅ Espiral gerada com ${gameState.obstacles.length} obstáculos`);
}

function generateZigZagMaze() {
    addLogEntry('system', '⚡ Gerando labirinto zigue-zague...');
    
    for (let row = 1; row < GRID_SIZE - 1; row += 2) {
        // Linha horizontal
        for (let col = 1; col < GRID_SIZE - 1; col++) {
            if (isValidObstaclePosition(row, col)) {
                gameState.obstacles.push([row, col]);
            }
        }
        
        // Conexão vertical alternada
        if (row < GRID_SIZE - 2) {
            const connectCol = (row / 2) % 2 === 0 ? 1 : GRID_SIZE - 2;
            if (isValidObstaclePosition(row + 1, connectCol)) {
                gameState.obstacles.push([row + 1, connectCol]);
            }
        }
    }
    
    addLogEntry('success', `✅ Zigue-zague gerado com ${gameState.obstacles.length} obstáculos`);
}

function generateCrossMaze() {
    addLogEntry('system', '✨ Gerando labirinto em cruz...');
    
    const center = Math.floor(GRID_SIZE / 2);
    
    // Cruz vertical
    for (let row = 1; row < GRID_SIZE - 1; row++) {
        if (row !== center && isValidObstaclePosition(row, center)) {
            gameState.obstacles.push([row, center]);
        }
    }
    
    // Cruz horizontal
    for (let col = 1; col < GRID_SIZE - 1; col++) {
        if (col !== center && isValidObstaclePosition(center, col)) {
            gameState.obstacles.push([center, col]);
        }
    }
    
    // Quadrantes com obstáculos esparsos
    for (let quad = 0; quad < 4; quad++) {
        const startRow = quad < 2 ? 1 : center + 1;
        const endRow = quad < 2 ? center - 1 : GRID_SIZE - 2;
        const startCol = quad % 2 === 0 ? 1 : center + 1;
        const endCol = quad % 2 === 0 ? center - 1 : GRID_SIZE - 2;
        
        // Adicionar alguns obstáculos aleatórios em cada quadrante
        const obstaclesPerQuad = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < obstaclesPerQuad; i++) {
            const row = startRow + Math.floor(Math.random() * (endRow - startRow + 1));
            const col = startCol + Math.floor(Math.random() * (endCol - startCol + 1));
            
            if (isValidObstaclePosition(row, col)) {
                gameState.obstacles.push([row, col]);
            }
        }
    }
    
    addLogEntry('success', `✅ Cruz gerada com ${gameState.obstacles.length} obstáculos`);
}

function generateChambersMaze() {
    addLogEntry('system', '🏠 Gerando labirinto de câmaras...');
    
    // Criar câmaras 3x3 com corredores
    const chamberSize = 3;
    const chambers = [];
    
    for (let r = 0; r < GRID_SIZE; r += chamberSize + 1) {
        for (let c = 0; c < GRID_SIZE; c += chamberSize + 1) {
            chambers.push({row: r, col: c});
        }
    }
    
    chambers.forEach(chamber => {
        // Criar paredes da câmara
        for (let dr = 0; dr < chamberSize; dr++) {
            for (let dc = 0; dc < chamberSize; dc++) {
                const row = chamber.row + dr;
                const col = chamber.col + dc;
                
                // Paredes externas da câmara
                if (dr === 0 || dr === chamberSize - 1 || dc === 0 || dc === chamberSize - 1) {
                    if (isValidObstaclePosition(row, col)) {
                        gameState.obstacles.push([row, col]);
                    }
                }
            }
        }
        
        // Criar uma abertura aleatória em cada parede
        const walls = ['top', 'right', 'bottom', 'left'];
        const openWall = walls[Math.floor(Math.random() * walls.length)];
        
        let openRow, openCol;
        switch(openWall) {
            case 'top':
                openRow = chamber.row;
                openCol = chamber.col + Math.floor(Math.random() * chamberSize);
                break;
            case 'bottom':
                openRow = chamber.row + chamberSize - 1;
                openCol = chamber.col + Math.floor(Math.random() * chamberSize);
                break;
            case 'left':
                openRow = chamber.row + Math.floor(Math.random() * chamberSize);
                openCol = chamber.col;
                break;
            case 'right':
                openRow = chamber.row + Math.floor(Math.random() * chamberSize);
                openCol = chamber.col + chamberSize - 1;
                break;
        }
        
        // Remover obstáculo da abertura
        gameState.obstacles = gameState.obstacles.filter(obs => 
            !(obs[0] === openRow && obs[1] === openCol));
    });
    
    addLogEntry('success', `✅ Câmaras geradas com ${gameState.obstacles.length} obstáculos`);
}

function isValidObstaclePosition(row, col) {
    // Não pode ser início ou fim
    if ((row === gameState.start[0] && col === gameState.start[1]) ||
        (row === gameState.goal[0] && col === gameState.goal[1])) {
        return false;
    }
    
    // Não pode já ter obstáculo
    if (gameState.obstacles.some(obs => obs[0] === row && obs[1] === col) ||
        gameState.dynamicObstacles.some(obs => obs[0] === row && obs[1] === col)) {
        return false;
    }
    
    // Deve estar dentro dos limites
    return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

function clearCurrentScenario() {
    gameState.obstacles = [];
    gameState.dynamicObstacles = [];
    gameState.currentPath = [];
    gameState.visitedCells = [];
    gameState.steppedCells = [];
    gameState.detourCells = [];
    gameState.customPath = [];
    gameState.waypoints = [];
    gameState.stats.dynamicObstacles = 0;
    gameState.stats.replanningCount = 0;
    gameState.stats.cellsProcessed = 0;
    gameState.stats.pathLength = 0;
}

function fixImpossibleScenario() {
    // Remove obstáculos aleatórios até encontrar um caminho
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
        const testPath = findPath(gameState.start, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
        if (testPath.length > 0) {
            addLogEntry('success', `✅ Cenário corrigido! Caminho encontrado com ${testPath.length} passos`);
            
            // Aplicar caminho corrigido
            gameState.currentPath = testPath;
            gameState.originalPath = [...testPath];
            gameState.stats.pathLength = testPath.length;
            
            addLogEntry('pathfinding', `🧠 Caminho calculado após correção: ${testPath.length} passos`);
            addLogEntry('system', `🚀 Cenário pronto! Clique em "🚶 Iniciar Caminhada"`);
            return;
        }
        
        // Remove um obstáculo aleatório
        if (gameState.obstacles.length > 0) {
            const randomIndex = Math.floor(Math.random() * gameState.obstacles.length);
            const removed = gameState.obstacles.splice(randomIndex, 1)[0];
            addLogEntry('system', `🔧 Removido obstáculo em (${removed[0]},${removed[1]})`);
        }
        
        attempts++;
    }
    
    addLogEntry('error', '❌ Não foi possível corrigir o cenário. Gerando cenário simples...');
    generateSimpleFallbackScenario();
}

function generateSimpleFallbackScenario() {
    clearCurrentScenario();
    // Cenário super simples garantido
    gameState.obstacles = [[2,2], [3,3], [6,6], [7,7]];
    gameState.dynamicObstacles = [[4,4]];
    gameState.stats.dynamicObstacles = 1;
    
    // Calcular caminho do fallback
    const fallbackPath = findPath(gameState.start, gameState.goal, gameState.obstacles.concat(gameState.dynamicObstacles));
    gameState.currentPath = fallbackPath;
    gameState.originalPath = [...fallbackPath];
    gameState.stats.pathLength = fallbackPath.length;
    
    addLogEntry('system', '🛟 Cenário de fallback gerado - sempre funciona!');
    addLogEntry('pathfinding', `🧠 Caminho fallback: ${fallbackPath.length} passos`);
    addLogEntry('success', `✅ Pronto para começar!`);
}

function addRandomPokemonToMaze(min, max) {
    const pokemonCount = min + Math.floor(Math.random() * (max - min + 1));
    let added = 0;
    
    for (let i = 0; i < pokemonCount * 5 && added < pokemonCount; i++) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        
        if (isValidObstaclePosition(row, col)) {
            gameState.dynamicObstacles.push([row, col]);
            gameState.stats.dynamicObstacles++;
            added++;
        }
    }
    
    addLogEntry('system', `🐛 Adicionados ${added} pokémon ao labirinto`);
}

function updateVisualAfterScenarioGeneration() {
    // Sempre atualizar estatísticas
    updateStats();
    
    if (currentMode === 'interactive') {
        // No modo interativo, usar o caminho já calculado
        updateGridVisually();
    } else if (currentMode === 'custom') {
        updateGridVisually();
    } else {
        // No modo demo, mostrar o grid com o cenário gerado
        createGrid();
    }
    
    // Criar personagem na posição inicial
    createCharacter();
}

// === SISTEMA DE TEMA ===
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        themeToggle.textContent = '☀️ Modo Claro';
        localStorage.setItem('darkTheme', 'true');
        addLogEntry('system', '🌙 Tema escuro ativado - muito melhor para os olhos!');
    } else {
        themeToggle.textContent = '🌙 Modo Escuro';
        localStorage.setItem('darkTheme', 'false');
        addLogEntry('system', '☀️ Tema claro ativado');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('darkTheme');
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (savedTheme === 'true') {
        body.classList.add('dark-theme');
        themeToggle.textContent = '☀️ Modo Claro';
    } else {
        body.classList.remove('dark-theme');
        themeToggle.textContent = '🌙 Modo Escuro';
    }
}

// === CONFIGURAÇÕES AVANÇADAS ===

function toggleAdvancedSettings() {
    const content = document.getElementById('settings-content');
    const toggle = document.getElementById('settings-toggle');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        toggle.textContent = '▼';
        addLogEntry('system', '🔧 Configurações avançadas expandidas');
    } else {
        content.classList.add('collapsed');
        toggle.textContent = '▶';
        addLogEntry('system', '🔧 Configurações avançadas recolhidas');
    }
}

function changeGridSize(newSize) {
    const oldSize = GRID_SIZE;
    GRID_SIZE = parseInt(newSize);
    advancedConfig.gridSize = GRID_SIZE;
    
    // Parar caminhada se estiver ativa
    if (isWalking) {
        stopWalking();
    }
    
    // RESET COMPLETO DAS POSIÇÕES - muito mais seguro
    addLogEntry('system', `📐 Redimensionando grid de ${oldSize}x${oldSize} para ${GRID_SIZE}x${GRID_SIZE}`);
    
    // Posições fixas e seguras baseadas no novo tamanho
    gameState.start = [0, 0]; // Sempre canto superior esquerdo
    gameState.goal = [GRID_SIZE - 1, GRID_SIZE - 1]; // Sempre canto inferior direito
    
    // Limpar TUDO que pode causar problemas
    gameState.obstacles = [];
    gameState.dynamicObstacles = [];
    gameState.currentPath = [];
    gameState.visitedCells = [];
    gameState.steppedCells = [];
    gameState.detourCells = [];
    gameState.customPath = [];
    gameState.waypoints = [];
    gameState.originalPath = [];
    
    // Resetar stats
    gameState.stats = {
        cellsProcessed: 0,
        dynamicObstacles: 0,
        replanningCount: 0,
        pathLength: 0
    };
    
    // Resetar variáveis de caminhada
    currentWalkStep = 0;
    finalApproach = false;
    
    // Adicionar alguns obstáculos simples baseados no tamanho do grid
    const numObstacles = Math.floor(GRID_SIZE * 0.8); // 80% do tamanho
    for (let i = 0; i < numObstacles; i++) {
        const row = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1; // Evitar bordas
        const col = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        
        // Não colocar obstáculo no início ou fim
        if ((row !== 0 || col !== 0) && (row !== GRID_SIZE-1 || col !== GRID_SIZE-1)) {
            if (!gameState.obstacles.some(obs => obs[0] === row && obs[1] === col)) {
                gameState.obstacles.push([row, col]);
            }
        }
    }
    
    addLogEntry('system', `🎯 Posições resetadas: Início(0,0), Destino(${GRID_SIZE-1},${GRID_SIZE-1})`);
    addLogEntry('system', `📊 Adicionados ${gameState.obstacles.length} obstáculos aleatórios`);
    
    // Ajustar tamanho das células no CSS dinamicamente
    updateGridCellSize();
    
    // Recriar grid COMPLETAMENTE
    createGrid();
    
    // Calcular caminho automaticamente no modo interativo
    if (currentMode === 'interactive') {
        setTimeout(() => {
            calculateAndShowPath();
        }, 100);
    }
    
    const dims = getGridDimensions();
    addLogEntry('success', `✅ Grid ${GRID_SIZE}x${GRID_SIZE} criado - Células: ${dims.cellSize}px, Personagem: ${dims.characterSize}px`);
}

function updateGridCellSize() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    
    const dims = getGridDimensions();
    
    let fontSize;
    switch(GRID_SIZE) {
        case 8: fontSize = 14; break;
        case 10: fontSize = 12; break;
        default: fontSize = 12;
    }
    
    console.log(`🔧 Atualizando grid ${GRID_SIZE}x${GRID_SIZE} com células ${dims.cellSize}px`);
    
    // 1. Atualizar grid CSS
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, ${dims.cellSize}px)`;
    grid.style.gap = dims.gap + 'px';
    grid.style.width = 'fit-content';
    grid.style.height = 'fit-content';
    grid.style.transform = 'none';
    grid.style.margin = '20px auto';
    
    // 2. Atualizar células
    const cells = grid.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.width = dims.cellSize + 'px';
        cell.style.height = dims.cellSize + 'px';
        cell.style.fontSize = fontSize + 'px';
    });
    
    // 3. Calcular se precisa de escala
    const totalWidth = GRID_SIZE * dims.cellSize + (GRID_SIZE - 1) * dims.gap + 40;
    const maxWidth = window.innerWidth * 0.6; // 60% da tela
    
    if (totalWidth > maxWidth) {
        const scale = maxWidth / totalWidth;
        grid.style.transform = `scale(${scale})`;
        grid.style.transformOrigin = 'center';
        addLogEntry('system', `📏 Grid reduzido para ${(scale * 100).toFixed(0)}%`);
    } else {
        addLogEntry('system', `📐 Grid ${GRID_SIZE}x${GRID_SIZE} em tamanho normal`);
    }
    
    console.log(`✅ Grid: ${cells.length} células, total: ${totalWidth}px`);
    
    // 4. Reposicionar robô
    if (character) {
        repositionCharacter();
    }
}

function repositionCharacter(scale = 1) {
    if (!character) return;
    
    const dims = getGridDimensions();
    
    // Validar e corrigir posição inicial
    if (gameState.start[0] >= GRID_SIZE || gameState.start[1] >= GRID_SIZE || 
        gameState.start[0] < 0 || gameState.start[1] < 0) {
        gameState.start = [0, 0];
        addLogEntry('system', '🎯 Posição inicial corrigida para (0,0)');
    }
    
    // Usar posição inicial como base
    let currentRow = gameState.start[0];
    let currentCol = gameState.start[1];
    
    // Se estiver caminhando, usar posição do caminho
    if (isWalking && gameState.currentPath && currentWalkStep > 0) {
        const currentPos = gameState.currentPath[Math.min(currentWalkStep - 1, gameState.currentPath.length - 1)];
        if (currentPos && currentPos[0] < GRID_SIZE && currentPos[1] < GRID_SIZE) {
            currentRow = currentPos[0];
            currentCol = currentPos[1];
        }
    }
    
    // Calcular posição baseada na célula real do DOM
    const targetCell = document.getElementById(`cell-${currentRow}-${currentCol}`);
    if (!targetCell) {
        console.error(`Célula (${currentRow},${currentCol}) não encontrada!`);
        return;
    }
    
    const targetCellRect = targetCell.getBoundingClientRect();
    const gridRect = targetCell.parentElement.getBoundingClientRect();
    
    // Posição relativa à grid container
    const cellLeft = targetCellRect.left - gridRect.left;
    const cellTop = targetCellRect.top - gridRect.top;
    
    // Centralizar o robô na célula usando as dimensões reais
    const left = cellLeft + (targetCellRect.width / 2) - (dims.characterSize / 2);
    const top = cellTop + (targetCellRect.height / 2) - (dims.characterSize / 2);
    
    // Aplicar posição
    character.style.left = left + 'px';
    character.style.top = top + 'px';
    character.style.width = dims.characterSize + 'px';
    character.style.height = dims.characterSize + 'px';
    
    console.log(`🤖 Robô posicionado em (${currentRow},${currentCol}) -> ${left}px, ${top}px`);
}

function changeMovementType(type) {
    advancedConfig.movementType = parseInt(type);
    const typeName = type === '8' ? '8-Direções (Diagonal)' : '4-Direções (Ortogonal)';
    
    addLogEntry('system', `🧭 Tipo de movimento alterado para: ${typeName}`);
    
    // Recalcular caminho se não estiver caminhando
    if (!isWalking && currentMode === 'interactive') {
        calculateAndShowPath();
    }
}

function changeObstacleSpeed(speed) {
    advancedConfig.obstacleSpeed = parseInt(speed);
    updateObstacleSpeedDisplay(speed);
    
    // Reiniciar obstáculos móveis com nova velocidade
    if (movingObstaclesInterval && currentMode === 'interactive') {
        stopMovingObstacles();
        setTimeout(() => {
            startMovingObstacles();
        }, 500);
    }
    
    addLogEntry('system', `🐛 Velocidade dos Pokémon alterada para ${(speed/1000).toFixed(1)}s`);
}

function updateObstacleSpeedDisplay(speed) {
    const display = document.getElementById('obstacle-speed-display');
    if (display) {
        display.textContent = (speed / 1000).toFixed(1) + 's';
    }
}

function changeSpawnFrequency(frequency) {
    advancedConfig.spawnFrequency = parseInt(frequency);
    updateSpawnFrequencyDisplay(frequency);
    
    // Parar spawn anterior
    if (spawnInterval) {
        clearInterval(spawnInterval);
        spawnInterval = null;
    }
    
    // Iniciar novo spawn se não for 0
    if (frequency > 0 && currentMode === 'interactive') {
        startAutoSpawn();
        addLogEntry('system', `⏰ Auto-spawn ativado: novo Pokémon a cada ${(frequency/1000).toFixed(1)}s`);
    } else {
        addLogEntry('system', '⏰ Auto-spawn desabilitado');
    }
}

function updateSpawnFrequencyDisplay(frequency) {
    const display = document.getElementById('spawn-frequency-display');
    if (display) {
        if (frequency === 0) {
            display.textContent = 'Desabilitado';
        } else {
            display.textContent = `${(frequency / 1000).toFixed(1)}s`;
        }
    }
}

function startAutoSpawn() {
    if (spawnInterval || advancedConfig.spawnFrequency === 0) return;
    
    spawnInterval = setInterval(() => {
        if (currentMode === 'interactive' && !isWalking) {
            // Só spawnar se não estiver caminhando para não atrapalhar
            addRandomPokemon();
        }
    }, advancedConfig.spawnFrequency);
}

function stopAutoSpawn() {
    if (spawnInterval) {
        clearInterval(spawnInterval);
        spawnInterval = null;
    }
}

function changeReplanLimit(limit) {
    advancedConfig.replanLimit = parseInt(limit);
    let limitText;
    
    switch(limit) {
        case '3': limitText = '3 recálculos (Rápido)'; break;
        case '5': limitText = '5 recálculos (Padrão)'; break;
        case '10': limitText = '10 recálculos (Persistente)'; break;
        case '-1': limitText = 'Ilimitado (Teimoso)'; break;
        default: limitText = limit + ' recálculos';
    }
    
    addLogEntry('system', `⚡ Limite de recálculos: ${limitText}`);
}

function toggleCoordinates(show) {
    advancedConfig.showCoordinates = show;
    
    const coords = document.querySelectorAll('.coords');
    if (coords.length > 0) {
        coords.forEach(coord => {
            coord.style.display = show ? 'block' : 'none';
        });
        addLogEntry('system', show ? '👁️ Coordenadas exibidas' : '👁️ Coordenadas ocultas');
    }
}

function toggleOriginalPathHighlight(highlight) {
    advancedConfig.highlightOriginal = highlight;
    
    if (highlight && gameState.originalPath.length > 0) {
        addLogEntry('system', '🎯 Caminho original destacado em amarelo');
        // Adicionar classe especial para caminho original
        gameState.originalPath.forEach(pos => {
            const cell = document.getElementById(`cell-${pos[0]}-${pos[1]}`);
            if (cell) {
                cell.classList.add('original-path-highlight');
            }
        });
    } else {
        addLogEntry('system', '🎯 Destaque do caminho original removido');
        // Remover classe especial
        document.querySelectorAll('.original-path-highlight').forEach(cell => {
            cell.classList.remove('original-path-highlight');
        });
    }
}

function resetToDefaults() {
    // Valores padrão
    const defaults = {
        gridSize: 10,
        movementType: 8,
        obstacleSpeed: 3000,
        spawnFrequency: 0,
        replanLimit: 5,
        showCoordinates: true,
        highlightOriginal: false
    };
    
    // Aplicar valores padrão
    document.getElementById('grid-size-select').value = defaults.gridSize;
    document.getElementById('movement-type-select').value = defaults.movementType;
    document.getElementById('obstacle-speed-slider').value = defaults.obstacleSpeed;
    document.getElementById('spawn-frequency-slider').value = defaults.spawnFrequency;
    document.getElementById('replan-limit-select').value = defaults.replanLimit;
    document.getElementById('show-coordinates').checked = defaults.showCoordinates;
    document.getElementById('highlight-original').checked = defaults.highlightOriginal;
    
    // Aplicar configurações
    Object.assign(advancedConfig, defaults);
    
    // Aplicar mudanças
    if (GRID_SIZE !== defaults.gridSize) {
        changeGridSize(defaults.gridSize);
    }
    changeMovementType(defaults.movementType);
    updateObstacleSpeedDisplay(defaults.obstacleSpeed);
    updateSpawnFrequencyDisplay(defaults.spawnFrequency);
    toggleCoordinates(defaults.showCoordinates);
    toggleOriginalPathHighlight(defaults.highlightOriginal);
    
    addLogEntry('success', '🔄 Configurações restauradas para os valores padrão');
}

function forceResetGrid() {
    // Forçar reset do grid para 10x10
    if (isWalking) {
        stopWalking();
    }
    
    // Resetar tamanho
    GRID_SIZE = 10;
    advancedConfig.gridSize = 10;
    document.getElementById('grid-size-select').value = 10;
    
    // Resetar posições
    gameState.start = [0, 0];
    gameState.goal = [9, 9];
    gameState.obstacles = [[2,2], [2,3], [3,3], [5,5], [5,6], [6,5], [7,8]];
    gameState.dynamicObstacles = [];
    gameState.currentPath = [];
    gameState.visitedCells = [];
    gameState.steppedCells = [];
    gameState.detourCells = [];
    gameState.customPath = [];
    gameState.waypoints = [];
    
    // Limpar stats
    gameState.stats = {
        cellsProcessed: 0,
        dynamicObstacles: 0,
        replanningCount: 0,
        pathLength: 0
    };
    
    addLogEntry('system', '⚡ RESET FORÇADO - Grid resetado para 10x10');
    addLogEntry('system', '🎯 Posições resetadas: Início(0,0), Destino(9,9)');
    
    // Recriar grid
    createGrid();
    
    addLogEntry('success', '✅ Grid resetado com sucesso!');
}

function forceCreateRobot() {
    addLogEntry('system', '🤖 Forçando recriação do robô...');
    
    // Garantir posição válida
    if (gameState.start[0] >= GRID_SIZE || gameState.start[1] >= GRID_SIZE || 
        gameState.start[0] < 0 || gameState.start[1] < 0) {
        gameState.start = [0, 0];
        addLogEntry('system', '🎯 Posição inicial corrigida para (0,0)');
    }
    
    // Remover qualquer robô existente
    const existingRobot = document.getElementById('walking-character');
    if (existingRobot) {
        existingRobot.remove();
        addLogEntry('system', '🗑️ Robô antigo removido');
    }
    
    // Resetar variável
    character = null;
    
    // Criar novo robô
    createCharacter();
    
    // Recalcular caminho se necessário
    if (currentMode === 'interactive') {
        setTimeout(() => {
            calculateAndShowPath();
        }, 100);
    }
    
    addLogEntry('success', '✅ Robô recriado com sucesso!');
}

function saveSettings() {
    try {
        localStorage.setItem('astarAdvancedConfig', JSON.stringify(advancedConfig));
        addLogEntry('success', '💾 Configurações salvas com sucesso!');
    } catch (error) {
        addLogEntry('error', '❌ Erro ao salvar configurações: ' + error.message);
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('astarAdvancedConfig');
        if (saved) {
            const config = JSON.parse(saved);
            
            // Aplicar configurações salvas aos controles
            document.getElementById('grid-size-select').value = config.gridSize || 10;
            document.getElementById('movement-type-select').value = config.movementType || 8;
            document.getElementById('obstacle-speed-slider').value = config.obstacleSpeed || 3000;
            document.getElementById('spawn-frequency-slider').value = config.spawnFrequency || 0;
            document.getElementById('replan-limit-select').value = config.replanLimit || 5;
            document.getElementById('show-coordinates').checked = config.showCoordinates !== false;
            document.getElementById('highlight-original').checked = config.highlightOriginal || false;
            
            // Aplicar configurações
            Object.assign(advancedConfig, config);
            
            // Aplicar mudanças visuais (apenas se o grid for diferente)
            if (GRID_SIZE !== config.gridSize && document.getElementById('grid')) {
                changeGridSize(config.gridSize);
            } else if (config.gridSize) {
                // Só atualizar a variável se o elemento não existir ainda
                GRID_SIZE = config.gridSize;
                advancedConfig.gridSize = config.gridSize;
            }
            updateObstacleSpeedDisplay(config.obstacleSpeed || 3000);
            updateSpawnFrequencyDisplay(config.spawnFrequency || 0);
            toggleCoordinates(config.showCoordinates !== false);
            toggleOriginalPathHighlight(config.highlightOriginal || false);
            
            addLogEntry('success', '📁 Configurações carregadas com sucesso!');
        } else {
            addLogEntry('system', '📁 Nenhuma configuração salva encontrada');
        }
    } catch (error) {
        addLogEntry('error', '❌ Erro ao carregar configurações: ' + error.message);
    }
}

// Inicialização
window.addEventListener('load', function() {
    console.log('🔄 Iniciando sistema A*...');
    
    try {
        console.log('📋 Carregando tema...');
        loadTheme(); // Carregar tema salvo
        
        console.log('🎮 Criando grid inicial...');
        createGrid(demoSteps[0]);
        
        // Log inicial sobre modo educacional
        setTimeout(() => {
            addLogEntry('system', '🎓 Sistema de Log Duplo ativo - Sistema | Educacional');
            addLogEntry('learning', '🎓 Log Educacional ativo - O A* explicará suas decisões aqui!');
            addLogEntry('learning', '💡 Use o botão "🎓 ON/OFF" no cabeçalho para controlar este log');
        }, 300);
        
        console.log('⚙️ Carregando configurações...');
        // Carregar configurações de forma segura
        setTimeout(() => {
            try {
                loadSettings();
            } catch (settingsError) {
                console.warn('Erro ao carregar configurações:', settingsError);
            }
        }, 100);
        
        console.log('🎛️ Inicializando displays...');
        // Inicializar displays com timeout para garantir que elementos existam
        setTimeout(() => {
            updateObstacleSpeedDisplay(advancedConfig.obstacleSpeed);
            updateSpawnFrequencyDisplay(advancedConfig.spawnFrequency);
        }, 200);
        
        console.log('🖱️ Configurando eventos...');
        // Adicionar eventos globais do mouse para desenho
        document.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        // Adicionar evento de clique no header das configurações
        setTimeout(() => {
            const settingsHeader = document.querySelector('.settings-header');
            if (settingsHeader) {
                settingsHeader.addEventListener('click', toggleAdvancedSettings);
                console.log('✅ Eventos das configurações configurados');
            } else {
                console.warn('⚠️ Header das configurações não encontrado');
            }
        }, 100);
        
        // Adicionar evento de redimensionamento da janela
        window.addEventListener('resize', () => {
            console.log('🔄 Janela redimensionada, recalculando grid...');
            setTimeout(() => {
                updateGridCellSize();
            }, 100);
        });
        
        addLogEntry('success', '🚀 Sistema inicializado com sucesso!');
        console.log('✅ Inicialização completa!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        
        // Tentar criar grid básico mesmo com erro
        try {
            console.log('🔧 Tentando criar grid de emergência...');
            createGrid(demoSteps[0]);
            console.log('✅ Grid de emergência criado');
        } catch (gridError) {
            console.error('💥 Erro crítico ao criar grid:', gridError);
            alert('Erro crítico: Não foi possível inicializar o simulador. Verifique o console para mais detalhes.');
        }
    }
});