-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 08/06/2026 às 00:42
-- Versão do servidor: 10.4.32-MariaDB
-- Versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `processovacuo`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `alertasseguranca`
--

CREATE TABLE `alertasseguranca` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL,
  `dataHora` datetime DEFAULT current_timestamp(),
  `nivelGravidade` enum('Leve','Médio','Grave','Muito Grave') DEFAULT NULL,
  `descricao` text DEFAULT NULL,
  `leituraId` int(11) DEFAULT NULL,
  `resolvido` tinyint(1) DEFAULT 0,
  `dataHoraResolucao` datetime DEFAULT NULL,
  `operadorResolucaoId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ciclosprocesso`
--

CREATE TABLE `ciclosprocesso` (
  `id` int(11) NOT NULL,
  `operadorResponsavelId` int(11) DEFAULT NULL,
  `dataInicio` datetime DEFAULT current_timestamp(),
  `dataFim` datetime DEFAULT NULL,
  `status` enum('Em Andamento','Concluído','Abortado - Emergência') DEFAULT 'Em Andamento'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `ciclosprocesso`
--

INSERT INTO `ciclosprocesso` (`id`, `operadorResponsavelId`, `dataInicio`, `dataFim`, `status`) VALUES
(1, NULL, '2026-04-27 20:07:23', '2026-05-28 21:27:08', 'Concluído'),
(2, NULL, '2026-06-04 19:40:11', NULL, 'Em Andamento'),
(3, NULL, '2026-06-04 19:45:00', NULL, 'Em Andamento'),
(4, NULL, '2026-06-04 20:06:13', NULL, 'Em Andamento');

-- --------------------------------------------------------

--
-- Estrutura para tabela `comandosservo`
--

CREATE TABLE `comandosservo` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL DEFAULT 0,
  `dataHora` datetime NOT NULL,
  `angulo` float NOT NULL,
  `origem` varchar(100) DEFAULT 'API',
  `executado` tinyint(1) NOT NULL DEFAULT 0,
  `dataExecucao` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `comandosservo`
--

INSERT INTO `comandosservo` (`id`, `cicloId`, `dataHora`, `angulo`, `origem`, `executado`, `dataExecucao`) VALUES
(1, 1, '2026-06-03 16:31:03', 90, 'Console Test', 0, NULL),
(2, 1, '2026-06-03 16:39:54', 90, 'Console Test', 0, NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `leiturassensores`
--

CREATE TABLE `leiturassensores` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL,
  `dataHora` datetime DEFAULT current_timestamp(),
  `estadoMaquina` enum('Ligado','Desligado') DEFAULT NULL,
  `pressaoCamaraMbar` float DEFAULT NULL,
  `pressaoTubo1Mbar` float DEFAULT NULL,
  `fluxoTubo1LPM` float DEFAULT NULL,
  `pressaoTubo2Mbar` float DEFAULT NULL,
  `fluxoTubo2LPM` float DEFAULT NULL,
  `pressaoTubo3Mbar` float DEFAULT NULL,
  `fluxoTubo3LPM` float DEFAULT NULL,
  `bombaLigada` tinyint(1) DEFAULT 0,
  `valvulaAberta` tinyint(1) DEFAULT 0,
  `servoAngulo` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `leiturassensores`
--

INSERT INTO `leiturassensores` (`id`, `cicloId`, `dataHora`, `estadoMaquina`, `pressaoCamaraMbar`, `pressaoTubo1Mbar`, `fluxoTubo1LPM`, `pressaoTubo2Mbar`, `fluxoTubo2LPM`, `pressaoTubo3Mbar`, `fluxoTubo3LPM`, `bombaLigada`, `valvulaAberta`, `servoAngulo`) VALUES
(16, 1, '2026-04-27 20:07:42', 'Ligado', 500, 300, 2.5, 280, 2.3, 290, 2.4, 0, 0, 0),
(17, 1, '2026-04-27 20:08:39', 'Desligado', 510.63, 533.97, 0, 499.62, 0, 470.03, 0, 0, 0, 0),
(18, 1, '2026-04-27 20:08:44', 'Desligado', 463.58, 497.14, 0, 501.09, 0, 434.48, 0, 0, 0, 0),
(19, 1, '2026-04-27 20:09:19', 'Desligado', 466.41, 474.09, 0, 485.8, 0, 427.29, 0, 0, 0, 0);

-- --------------------------------------------------------

--
-- Estrutura para tabela `operadores`
--

CREATE TABLE `operadores` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `identificador` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `operadores`
--

INSERT INTO `operadores` (`id`, `nome`, `identificador`) VALUES
(1, 'Admin', 'OP-001');

-- --------------------------------------------------------

--
-- Estrutura para tabela `registrovalvulas`
--

CREATE TABLE `registrovalvulas` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL,
  `dataHora` datetime DEFAULT current_timestamp(),
  `nomeValvula` varchar(50) DEFAULT NULL,
  `estado` enum('Aberta','Fechada') DEFAULT NULL,
  `motivo` varchar(100) DEFAULT NULL,
  `operadorId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `reguladores`
--

CREATE TABLE `reguladores` (
  `id` int(11) NOT NULL,
  `numeroSerie` varchar(50) NOT NULL,
  `statusOleo` varchar(60) DEFAULT NULL,
  `cicloId` int(11) NOT NULL,
  `dataEntrada` datetime DEFAULT current_timestamp(),
  `dataSaida` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `alertasseguranca`
--
ALTER TABLE `alertasseguranca`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cicloId` (`cicloId`),
  ADD KEY `leituraId` (`leituraId`),
  ADD KEY `operadorResolucaoId` (`operadorResolucaoId`);

--
-- Índices de tabela `ciclosprocesso`
--
ALTER TABLE `ciclosprocesso`
  ADD PRIMARY KEY (`id`),
  ADD KEY `operadorResponsavelId` (`operadorResponsavelId`);

--
-- Índices de tabela `comandosservo`
--
ALTER TABLE `comandosservo`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `leiturassensores`
--
ALTER TABLE `leiturassensores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cicloId` (`cicloId`),
  ADD KEY `idx_dataHora_leituras` (`dataHora`);

--
-- Índices de tabela `operadores`
--
ALTER TABLE `operadores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `identificador` (`identificador`);
  ALTER TABLE operadores
  ADD COLUMN papel ENUM('supervisor','engenheiro','operador') NOT NULL DEFAULT 'operador',
  ADD COLUMN email VARCHAR(100) DEFAULT NULL;

--
-- Índices de tabela `registrovalvulas`
--
ALTER TABLE `registrovalvulas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cicloId` (`cicloId`),
  ADD KEY `operadorId` (`operadorId`);

--
-- Índices de tabela `reguladores`
--
ALTER TABLE `reguladores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cicloId` (`cicloId`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `alertasseguranca`
--
ALTER TABLE `alertasseguranca`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `ciclosprocesso`
--
ALTER TABLE `ciclosprocesso`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de tabela `comandosservo`
--
ALTER TABLE `comandosservo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de tabela `leiturassensores`
--
ALTER TABLE `leiturassensores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3014;

--
-- AUTO_INCREMENT de tabela `operadores`
--
ALTER TABLE `operadores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `registrovalvulas`
--
ALTER TABLE `registrovalvulas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `reguladores`
--
ALTER TABLE `reguladores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `alertasseguranca`
--
ALTER TABLE `alertasseguranca`
  ADD CONSTRAINT `alertasseguranca_ibfk_1` FOREIGN KEY (`cicloId`) REFERENCES `ciclosprocesso` (`id`),
  ADD CONSTRAINT `alertasseguranca_ibfk_2` FOREIGN KEY (`leituraId`) REFERENCES `leiturassensores` (`id`),
  ADD CONSTRAINT `alertasseguranca_ibfk_3` FOREIGN KEY (`operadorResolucaoId`) REFERENCES `operadores` (`id`);

--
-- Restrições para tabelas `ciclosprocesso`
--
ALTER TABLE `ciclosprocesso`
  ADD CONSTRAINT `ciclosprocesso_ibfk_1` FOREIGN KEY (`operadorResponsavelId`) REFERENCES `operadores` (`id`);

--
-- Restrições para tabelas `leiturassensores`
--
ALTER TABLE `leiturassensores`
  ADD CONSTRAINT `leiturassensores_ibfk_1` FOREIGN KEY (`cicloId`) REFERENCES `ciclosprocesso` (`id`);

--
-- Restrições para tabelas `registrovalvulas`
--
ALTER TABLE `registrovalvulas`
  ADD CONSTRAINT `registrovalvulas_ibfk_1` FOREIGN KEY (`cicloId`) REFERENCES `ciclosprocesso` (`id`),
  ADD CONSTRAINT `registrovalvulas_ibfk_2` FOREIGN KEY (`operadorId`) REFERENCES `operadores` (`id`);

--
-- Restrições para tabelas `reguladores`
--
ALTER TABLE `reguladores`
  ADD CONSTRAINT `reguladores_ibfk_1` FOREIGN KEY (`cicloId`) REFERENCES `ciclosprocesso` (`id`);
COMMIT;

CREATE TABLE ciclos (
  id int(11) NOT NULL AUTO_INCREMENT,
  operadorId int(11) NOT NULL DEFAULT 0,
  dataInicio datetime NOT NULL,
  dataFim datetime DEFAULT NULL,
  status enum('iniciando','estagio1','estagio2','holding','parando','parado','erro') NOT NULL DEFAULT 'iniciando',
  PRIMARY KEY (id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE comandosbomba (
  id int(11) NOT NULL AUTO_INCREMENT,
  cicloId int(11) NOT NULL DEFAULT 0,
  dataHora datetime NOT NULL,
  ligar tinyint(1) NOT NULL,
  origem varchar(20) NOT NULL DEFAULT 'API',
  executado tinyint(1) NOT NULL DEFAULT 0,
  dataExecucao datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_executado (executado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE comandosciclo (
  id int(11) NOT NULL AUTO_INCREMENT,
  cicloId int(11) NOT NULL DEFAULT 0,
  dataHora datetime NOT NULL,
  acao enum('START','STOP') NOT NULL,
  origem varchar(20) NOT NULL DEFAULT 'API',
  executado tinyint(1) NOT NULL DEFAULT 0,
  dataExecucao datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_executado (executado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
