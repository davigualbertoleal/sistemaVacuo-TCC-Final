-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 02/06/2026 às 06:14
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

--
-- Despejando dados para a tabela `alertasseguranca`
--

INSERT INTO `alertasseguranca` (`id`, `cicloId`, `dataHora`, `nivelGravidade`, `descricao`, `leituraId`, `resolvido`, `dataHoraResolucao`, `operadorResolucaoId`) VALUES
(1, 1, '2026-06-01 20:38:34', 'Grave', 'Emergência acionada pelo operador OP-003 (João Marcos)', NULL, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `ciclos`
--

CREATE TABLE `ciclos` (
  `id` int(11) NOT NULL,
  `operadorId` int(11) NOT NULL DEFAULT 0,
  `dataInicio` datetime NOT NULL,
  `dataFim` datetime DEFAULT NULL,
  `status` enum('iniciando','estagio1','estagio2','holding','parando','parado','erro') NOT NULL DEFAULT 'iniciando'
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
(1, NULL, '2026-04-27 20:07:23', '2026-05-02 01:09:06', 'Concluído');

-- --------------------------------------------------------

--
-- Estrutura para tabela `comandosbomba`
--

CREATE TABLE `comandosbomba` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL DEFAULT 0,
  `dataHora` datetime NOT NULL,
  `ligar` tinyint(1) NOT NULL,
  `origem` varchar(20) NOT NULL DEFAULT 'API',
  `executado` tinyint(1) NOT NULL DEFAULT 0,
  `dataExecucao` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `comandosciclo`
--

CREATE TABLE `comandosciclo` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL DEFAULT 0,
  `dataHora` datetime NOT NULL,
  `acao` enum('START','STOP') NOT NULL,
  `origem` varchar(20) NOT NULL DEFAULT 'API',
  `executado` tinyint(1) NOT NULL DEFAULT 0,
  `dataExecucao` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `comandosservo`
--

CREATE TABLE `comandosservo` (
  `id` int(11) NOT NULL,
  `cicloId` int(11) NOT NULL DEFAULT 0,
  `dataHora` datetime NOT NULL,
  `angulo` float NOT NULL,
  `origem` varchar(20) NOT NULL DEFAULT 'API',
  `executado` tinyint(1) NOT NULL DEFAULT 0,
  `dataExecucao` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(19, 1, '2026-04-27 20:09:19', 'Desligado', 466.41, 474.09, 0, 485.8, 0, 427.29, 0, 0, 0, 0),
(20, 1, '2026-04-27 20:10:47', 'Desligado', 424.52, 442.45, 0, 553.95, 0, 414.11, 0, 0, 0, 0),
(21, 1, '2026-04-27 22:13:38', 'Ligado', 810.93, 799.81, 1.7, 743.58, 4.1, 865.26, 3.7, 0, 0, 0),
(28, 1, '2026-04-27 22:16:50', 'Ligado', 810.93, 799.81, 1.7, 664.91, 6, 945.55, 5.8, 0, 0, 0),
(32, 1, '2026-04-27 22:19:18', 'Ligado', 811.43, 799.31, 1.7, 295.77, 11.4, 845.95, 2.9, 0, 0, 0),
(33, 1, '2026-04-27 22:19:23', 'Ligado', 811.13, 799.51, 1.7, 318.15, 11.1, 824.61, 1.8, 0, 0, 0),
(34, 1, '2026-04-27 22:19:29', 'Ligado', 811.03, 799.31, 1.7, 324.77, 11, 840.19, 2.7, 0, 0, 0),
(35, 1, '2026-04-27 22:19:38', 'Ligado', 811.23, 799.41, 1.7, 325.56, 11, 762.39, 3.5, 0, 0, 0),
(36, 1, '2026-04-27 22:20:51', 'Ligado', 219.45, 503.64, 8.4, 327.38, 5.2, 784.9, 11.9, 0, 0, 0),
(37, 1, '2026-04-27 22:21:02', 'Ligado', 219.25, 181.73, 3.1, 303.44, 4.6, 726.31, 11.3, 0, 0, 0),
(38, 1, '2026-04-27 22:21:08', 'Ligado', 722.34, 595.84, 5.6, 342.37, 9.7, 752.57, 2.7, 0, 0, 0);

-- --------------------------------------------------------

--
-- Estrutura para tabela `operadores`
--

CREATE TABLE `operadores` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `identificador` varchar(20) NOT NULL,
  `papel` enum('supervisor','engenheiro','operador') NOT NULL DEFAULT 'operador'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `operadores`
--

INSERT INTO `operadores` (`id`, `nome`, `identificador`, `papel`) VALUES
(1, 'Carlos Silva', 'ENG-001', 'engenheiro'),
(2, 'João Souza', 'OP-001', 'operador'),
(3, 'João Marcos', 'op-003', 'operador'),
(4, 'Eduarda Coimbra', 'eng-002', 'engenheiro');

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
-- Índices de tabela `ciclos`
--
ALTER TABLE `ciclos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`);

--
-- Índices de tabela `ciclosprocesso`
--
ALTER TABLE `ciclosprocesso`
  ADD PRIMARY KEY (`id`),
  ADD KEY `operadorResponsavelId` (`operadorResponsavelId`);

--
-- Índices de tabela `comandosbomba`
--
ALTER TABLE `comandosbomba`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_executado` (`executado`);

--
-- Índices de tabela `comandosciclo`
--
ALTER TABLE `comandosciclo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_executado` (`executado`);

--
-- Índices de tabela `comandosservo`
--
ALTER TABLE `comandosservo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_executado` (`executado`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `ciclos`
--
ALTER TABLE `ciclos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `ciclosprocesso`
--
ALTER TABLE `ciclosprocesso`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `comandosbomba`
--
ALTER TABLE `comandosbomba`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `comandosciclo`
--
ALTER TABLE `comandosciclo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `comandosservo`
--
ALTER TABLE `comandosservo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `leiturassensores`
--
ALTER TABLE `leiturassensores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT de tabela `operadores`
--
ALTER TABLE `operadores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

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

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
