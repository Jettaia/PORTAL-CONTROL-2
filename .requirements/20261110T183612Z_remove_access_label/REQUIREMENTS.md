# As Is
A tela de entrada mostra “Acesso seguro” acima do título.
# To Be
Remover esse texto da tela de entrada.
# Requirements
1. Esvaziar o breadcrumb de entrada, preservando a navegação autenticada.
# Acceptance Criteria
1. A entrada exibe o título e formulário, sem “Acesso seguro”.
# Principal Regression Test
Smoke do navegador local: conferir breadcrumb vazio e título/formulário visíveis.
# Testing Plan
Verificação de sintaxe e smoke real. Sem teste permanente para remoção simples de texto.
# Implementation Plan
Substituir o texto do breadcrumb deslogado por string vazia e verificar o servidor local.

## Escopo adicional autorizado
Remover também a descrição de entrada: Entre para acessar as funcionalidades liberadas para o seu perfil.
Critério: breadcrumb e descrição vazios, com título e formulário preservados.

## Remoção do rodapé autorizada
Remover o rodapé Jetta Control · Piloto local · Financeiro de contratações. Verificar ausência no navegador.
