import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-20">
        <div className="rounded-3xl border border-ink-200 bg-white p-10 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="mt-4 text-lg text-ink-600 leading-relaxed">
            No Manejo Certo, a proteção dos dados da sua fazenda é prioridade. Aqui explicamos como
            coletamos, usamos e protegemos as informações que você confia ao sistema.
          </p>

          <section className="mt-10 space-y-8">
            <div>
              <h2 className="text-2xl font-semibold">1. Dados que coletamos</h2>
              <p className="mt-3 text-ink-600 leading-relaxed">
                Capturamos apenas as informações necessárias para fornecer o serviço, como email,
                nome da fazenda, dados de perfil, lançamentos financeiros e comprovantes fiscais.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold">2. Como usamos esses dados</h2>
              <p className="mt-3 text-ink-600 leading-relaxed">
                Utilizamos seus dados para autenticar o acesso, mostrar relatórios, armazenar
                comprovantes e garantir que sua fazenda tenha um controle financeiro seguro.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold">3. Segurança</h2>
              <p className="mt-3 text-ink-600 leading-relaxed">
                Seus dados ficam protegidos com as regras de acesso do Supabase e com políticas de
                autenticação. Somente você e pessoas autorizadas pela sua conta podem ver suas
                informações.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold">4. Contato</h2>
              <p className="mt-3 text-ink-600 leading-relaxed">
                Caso tenha dúvidas sobre privacidade, entre em contato pelo email{' '}
                <a href="mailto:suporte@manejocerto.com.br" className="font-semibold text-brand hover:text-brand-700">
                  suporte@manejocerto.com.br
                </a>
                .
              </p>
            </div>
          </section>

          <div className="mt-12 text-center">
            <Link
              to="/"
              className="inline-flex h-12 px-6 rounded-full bg-brand text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
