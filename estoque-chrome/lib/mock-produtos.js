// Catálogo de produtos MOCKADO — só para desenvolver e testar a busca do Módulo 1 (Balcão)
// enquanto a fonte de dados real do estoque (planilha ou sistema) não é conectada.
// Quando a fonte real existir, isso deixa de ser usado e a busca passa a consultá-la.

(function (root) {
  const PRODUTOS_MOCK = [
    { codigo: '1001', descricao: 'Torneira monocomando cozinha cromada' },
    { codigo: '1002', descricao: 'Torneira parede jardim 1/2 polegada' },
    { codigo: '1050', descricao: 'Registro de gaveta 3/4 bruto' },
    { codigo: '1051', descricao: 'Registro de pressão 1/2 cromado' },
    { codigo: '2010', descricao: 'Tubo PVC soldável 25mm 6m' },
    { codigo: '2011', descricao: 'Tubo PVC esgoto 100mm 6m' },
    { codigo: '2200', descricao: 'Joelho 90 graus PVC soldável 25mm' },
    { codigo: '3005', descricao: 'Cimento CP II 50kg' },
    { codigo: '3010', descricao: 'Argamassa colante AC II 20kg' },
    { codigo: '4020', descricao: 'Disjuntor bipolar 32A' },
    { codigo: '4021', descricao: 'Disjuntor monopolar 20A' },
    { codigo: '4100', descricao: 'Cabo flexível 2,5mm preto 100m' },
    { codigo: '5030', descricao: 'Tinta acrílica branca 18L' },
    { codigo: '5031', descricao: 'Tinta esmalte sintético branco 3,6L' },
    { codigo: '6001', descricao: 'Vaso sanitário com caixa acoplada branco' }
  ];

  root.EstoqueMockProdutos = PRODUTOS_MOCK;

  // Lista de vendedores (modo local). No modo planilha vem da aba "Vendedores".
  root.EstoqueMockVendedores = [
    { nome: 'Adriel', unidade: 'rio_claro' },
    { nome: 'Carina', unidade: 'rio_claro' },
    { nome: 'Davi', unidade: 'rio_claro' },
    { nome: 'Jaqueline', unidade: 'rio_claro' },
    { nome: 'João', unidade: 'rio_claro' },
    { nome: 'José Roberto', unidade: 'rio_claro' },
    { nome: 'Rafaela', unidade: 'rio_claro' },
    { nome: 'San', unidade: 'rio_claro' },
    { nome: 'Yan', unidade: 'araras' },
    { nome: 'Lyra', unidade: 'araras' },
    { nome: 'Carolina', unidade: 'araras' },
    { nome: 'Paulo', unidade: 'araras' },
    { nome: 'Reinaldo', unidade: 'araras' }
  ];
})(self);
