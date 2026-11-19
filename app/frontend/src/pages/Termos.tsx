import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Identificação de quem vende. Preencha `documento` (CPF ou CNPJ) e
 * `razaoSocial` quando a conta de recebimento estiver definida — enquanto
 * estiverem vazios, a página mostra só o nome comercial.
 */
const EMPRESA = {
  nome: 'Manejo Certo',
  razaoSocial: '',
  documento: '',
  email: 'suporte@manejocerto.com.br',
};

/** Data da última revisão destes termos — atualize ao alterar o texto. */
const ATUALIZADO_EM = '19 de novembro de 2026';

const PRAZO_TRIAL_DIAS = 14;
const PRAZO_ARREPENDIMENTO_DIAS = 7;
const AVISO_ENCERRAMENTO_DIAS = 90;

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold">{titulo}</h2>
      <div className="mt-3 space-y-3 text-ink-600 leading-relaxed">{children}</div>
    </div>
  );
}

const Email = () => (
  <a href={`mailto:${EMPRESA.email}`} className="font-semibold text-brand hover:text-brand-700">
    {EMPRESA.email}
  </a>
);

export default function Termos() {
  const identificacao = [EMPRESA.razaoSocial, EMPRESA.documento && `CPF/CNPJ ${EMPRESA.documento}`]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-12 sm:py-20">
        <div className="rounded-3xl border border-ink-200 bg-white p-6 sm:p-10 shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Termos de Uso</h1>
          <p className="mt-2 text-sm text-ink-500">Última atualização: {ATUALIZADO_EM}</p>
          <p className="mt-4 text-lg text-ink-600 leading-relaxed">
            Estes termos explicam as regras de uso do {EMPRESA.nome}
            {identificacao && <> ({identificacao})</>}, o que está incluído em cada plano e os seus
            direitos como cliente. Ao criar uma conta ou contratar um plano, você concorda com eles.
          </p>

          <section className="mt-10 space-y-8">
            <Secao titulo="1. O serviço">
              <p>
                O {EMPRESA.nome} é um sistema online de gestão para pecuária de corte: controle de
                lotes e animais, pesagens e ganho de peso, compras e vendas, lançamentos
                financeiros, relatórios e simulação de compra. Ele funciona no navegador e pode ser
                instalado no celular.
              </p>
              <p>
                Podemos melhorar, alterar ou incluir funcionalidades ao longo do tempo. Se alguma
                mudança retirar um recurso principal do plano que você pagou, avisaremos com
                antecedência pelo e-mail cadastrado.
              </p>
            </Secao>

            <Secao titulo="2. Sua conta">
              <p>
                Você é responsável pelas informações do cadastro, por manter sua senha em segredo e
                por tudo o que for feito com o seu acesso. Uma conta corresponde a uma fazenda ou
                operação. Se perceber uso indevido, avise-nos pelo e-mail <Email />.
              </p>
            </Secao>

            <Secao titulo="3. Teste grátis">
              <p>
                Toda conta nova tem {PRAZO_TRIAL_DIAS} dias de teste grátis, sem pedir cartão.
                Quando o teste termina, o acesso é bloqueado até a contratação de um plano. Seus
                dados continuam guardados e voltam a aparecer assim que o plano for ativado.
              </p>
            </Secao>

            <Secao titulo="4. Planos e pagamento">
              <p>
                Os preços em vigor ficam na página de planos. O pagamento é processado pelo Mercado
                Pago (Pix, cartão ou boleto) e o plano é ativado automaticamente quando o pagamento
                é aprovado.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-ink-900">Plano Anual:</strong> pagamento único que dá
                  acesso por 12 meses a partir da aprovação. <strong className="text-ink-900">Não
                  há renovação automática</strong> — perto do vencimento você escolhe se quer
                  renovar.
                </li>
                <li>
                  <strong className="text-ink-900">Plano Vitalício:</strong> pagamento único que dá
                  acesso, sem mensalidade, enquanto o {EMPRESA.nome} estiver em operação. O preço
                  pago fica congelado: você não paga de novo por reajustes futuros.
                </li>
              </ul>
            </Secao>

            <Secao titulo="5. Arrependimento e reembolso">
              <p>
                Você pode desistir da compra em até {PRAZO_ARREPENDIMENTO_DIAS} dias corridos
                após o pagamento, sem precisar justificar, e recebe o valor integral de volta
                (art. 49 do Código de Defesa do Consumidor). Basta pedir pelo e-mail <Email /> ou
                pelo WhatsApp de suporte. O estorno é feito pelo mesmo meio de pagamento, nos prazos
                do Mercado Pago e da operadora do cartão.
              </p>
              <p>
                Depois desse prazo não há reembolso proporcional do período não usado, salvo falha
                nossa que impeça o uso do serviço.
              </p>
            </Secao>

            <Secao titulo="6. Se o serviço for encerrado">
              <p>
                Se um dia decidirmos encerrar o {EMPRESA.nome}, avisaremos todos os clientes com
                pelo menos {AVISO_ENCERRAMENTO_DIAS} dias de antecedência e manteremos o acesso
                durante esse período para que você exporte seus dados (relatórios em PDF e CSV).
                Isso vale também para o plano vitalício.
              </p>
            </Secao>

            <Secao titulo="7. Seus dados">
              <p>
                Os dados da sua fazenda são seus. Você pode exportá-los pelos relatórios e pedir a
                exclusão da conta a qualquer momento. Não vendemos nem compartilhamos suas
                informações com terceiros para fins comerciais. Os detalhes estão na{' '}
                <Link to="/privacidade" className="font-semibold text-brand hover:text-brand-700">
                  Política de Privacidade
                </Link>
                .
              </p>
            </Secao>

            <Secao titulo="8. Uso sem internet">
              <p>
                O aplicativo permite registrar informações sem internet; elas ficam guardadas no
                aparelho e são enviadas quando a conexão volta. Até essa sincronização, os
                registros existem apenas naquele aparelho — se ele for perdido, formatado ou tiver
                os dados do navegador apagados antes de reconectar, esses registros podem se
                perder. O aplicativo indica no cabeçalho quando há registros pendentes de envio.
              </p>
            </Secao>

            <Secao titulo="9. Cálculos, simulações e WhatsApp">
              <p>
                Simulações de compra, ganho de peso, DRE, ponto de equilíbrio e demais indicadores
                são estimativas calculadas a partir dos dados e parâmetros que você informa. Eles
                apoiam a decisão, mas não substituem a avaliação de um técnico, zootecnista ou
                contador, e não garantem resultado financeiro.
              </p>
              <p>
                Quando disponível, o registro de manejo por mensagem ou áudio no WhatsApp é
                interpretado automaticamente e pode conter erros. Confira o que foi registrado; a
                responsabilidade pela informação final é de quem a confirmou.
              </p>
            </Secao>

            <Secao titulo="10. Uso correto">
              <p>
                Não é permitido tentar burlar o controle de acesso ou de pagamento, acessar dados
                de outros clientes, sobrecarregar o sistema de propósito ou revender o acesso.
                Nesses casos podemos suspender a conta.
              </p>
            </Secao>

            <Secao titulo="11. Disponibilidade e responsabilidade">
              <p>
                Trabalhamos para manter o sistema no ar e seus dados protegidos, mas podem ocorrer interrupções por manutenção ou por falhas de serviços de terceiros
                (hospedagem, internet, Mercado Pago, WhatsApp). Não respondemos por decisões de
                compra, venda ou manejo tomadas com base nas informações do sistema, nem por
                prejuízos indiretos, nos limites permitidos pela lei.
              </p>
            </Secao>

            <Secao titulo="12. Mudanças nestes termos">
              <p>
                Podemos atualizar estes termos. Mudanças importantes serão avisadas pelo e-mail
                cadastrado ou dentro do aplicativo antes de valerem. A data no topo da página
                mostra a última revisão.
              </p>
            </Secao>

            <Secao titulo="13. Contato e foro">
              <p>
                Dúvidas, pedidos de reembolso ou de exclusão de dados: <Email />. Estes termos
                seguem a lei brasileira, e eventuais disputas serão resolvidas no foro do
                domicílio do cliente, conforme o Código de Defesa do Consumidor.
              </p>
            </Secao>
          </section>

          <div className="mt-12 text-center">
            <Link
              to="/"
              className="inline-flex h-12 px-6 items-center rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
