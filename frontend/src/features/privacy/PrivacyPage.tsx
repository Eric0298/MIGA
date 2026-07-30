import { Link } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from '@/features/auth/auth-copy'
import type { Language } from '@/i18n/types'

type PrivacyCopy = {
  title: string
  updated: string
  review: string
  intro: string
  sections: Array<{ title: string; body: string }>
}

const privacyCopy: Record<Language, PrivacyCopy> = {
  es: {
    title: 'Política de privacidad',
    updated: 'Versión 2026-07-23',
    review: 'Pendiente de revisión jurídica',
    intro:
      'Este texto explica de forma provisional qué datos trata MIGA y qué controles ofrece. No constituye una declaración de cumplimiento normativo.',
    sections: [
      {
        title: 'Datos tratados',
        body: 'La cuenta registrada usa tu correo electrónico, una credencial protegida por el servidor y tus datos de estudio: metas, sesiones, materiales, progreso, apuntes, preguntas y resultados. La demo utiliza datos ficticios. El navegador conserva una copia local aislada para cada cuenta.',
      },
      {
        title: 'Finalidad y comunicaciones',
        body: 'Los datos se utilizan para prestar la aplicación, autenticarte, sincronizar tu progreso, recuperar el acceso y proteger operaciones sensibles. MIGA no necesita vender tus datos. Los vídeos incrustados de YouTube pueden comunicar datos técnicos a YouTube cuando los reproduces.',
      },
      {
        title: 'Archivos y copias',
        body: 'Los archivos binarios que añadas —PDF, vídeo, audio o imagen— permanecen en el almacenamiento local del navegador. No forman parte de la instantánea sincronizada ni de la copia JSON de datos estructurados. Borrar datos del navegador puede hacer que esos archivos dejen de estar disponibles.',
      },
      {
        title: 'Conservación',
        body: 'Una demo se conserva hasta su caducidad o restablecimiento. Una cuenta registrada se conserva mientras siga activa y se elimina al solicitar el borrado desde la aplicación, con las salvedades técnicas o legales que finalmente se documenten. Los plazos concretos de copias de seguridad aún deben definirse.',
      },
      {
        title: 'Tus controles y derechos',
        body: 'Puedes exportar tus datos, corregirlos dentro de la aplicación y eliminar tu cuenta. Los canales para ejercer acceso, rectificación, supresión, oposición, limitación o portabilidad, así como la identidad y contacto definitivos del responsable, están pendientes de revisión jurídica.',
      },
      {
        title: 'Seguridad y cambios',
        body: 'MIGA usa cookies de sesión protegidas y controles contra solicitudes falsificadas; las credenciales de sesión no se guardan en Web Storage. Esta política puede cambiar antes de una puesta en producción y deberá revisarse de nuevo si cambian los tratamientos.',
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    updated: 'Version 2026-07-23',
    review: 'Pending legal review',
    intro:
      'This provisional notice explains which data MIGA processes and the controls it offers. It is not a regulatory compliance statement.',
    sections: [
      {
        title: 'Data processed',
        body: 'A registered account uses your email, a server-protected credential, and study data: goals, sessions, materials, progress, notes, questions, and results. The demo uses fictional data. The browser keeps an isolated local copy for each account.',
      },
      {
        title: 'Purpose and disclosures',
        body: 'Data is used to provide the app, authenticate you, synchronize progress, recover access, and protect sensitive operations. MIGA does not need to sell your data. Embedded YouTube videos may send technical data to YouTube when played.',
      },
      {
        title: 'Files and copies',
        body: 'Binary files you add—PDF, video, audio, or images—remain in local browser storage. They are excluded from the synchronized snapshot and structured JSON backup. Clearing browser data may make those files unavailable.',
      },
      {
        title: 'Retention',
        body: 'A demo remains until it expires or is reset. A registered account remains while active and is removed when deletion is requested in the app, subject to technical or legal exceptions that are ultimately documented. Exact backup retention periods still need to be defined.',
      },
      {
        title: 'Your controls and rights',
        body: 'You can export, correct, and delete your data in the app. Channels for access, rectification, erasure, objection, restriction, or portability requests—and the final controller identity and contact—are pending legal review.',
      },
      {
        title: 'Security and changes',
        body: 'MIGA uses protected session cookies and request-forgery controls; session credentials are not stored in Web Storage. This policy may change before production and must be reviewed whenever processing changes.',
      },
    ],
  },
  va: {
    title: 'Política de privacitat',
    updated: 'Versió 2026-07-23',
    review: 'Pendent de revisió jurídica',
    intro:
      'Este text explica provisionalment quines dades tracta MIGA i quins controls oferix. No és una declaració de compliment normatiu.',
    sections: [
      {
        title: 'Dades tractades',
        body: 'El compte registrat usa el correu, una credencial protegida pel servidor i les dades d’estudi: metes, sessions, materials, progrés, apunts, preguntes i resultats. La demo usa dades fictícies. El navegador conserva una còpia local aïllada per compte.',
      },
      {
        title: 'Finalitat i comunicacions',
        body: 'Les dades s’usen per a prestar l’aplicació, autenticar-te, sincronitzar el progrés, recuperar l’accés i protegir operacions sensibles. MIGA no necessita vendre les teues dades. Els vídeos incrustats poden comunicar dades tècniques a YouTube quan els reproduïxes.',
      },
      {
        title: 'Arxius i còpies',
        body: 'Els arxius binaris que afegisques —PDF, vídeo, àudio o imatge— romanen en l’emmagatzematge local del navegador. No formen part de la instantània sincronitzada ni de la còpia JSON estructurada. Esborrar dades del navegador pot fer-los inaccessibles.',
      },
      {
        title: 'Conservació',
        body: 'Una demo es conserva fins que caduca o es restablix. Un compte registrat es conserva mentre estiga actiu i s’elimina quan se sol·licita des de l’aplicació, amb les excepcions que finalment es documenten. Els terminis concrets de còpies de seguretat encara s’han de definir.',
      },
      {
        title: 'Controls i drets',
        body: 'Pots exportar, corregir i eliminar les dades en l’aplicació. Els canals per a exercir accés, rectificació, supressió, oposició, limitació o portabilitat, i la identitat i contacte definitius del responsable, estan pendents de revisió jurídica.',
      },
      {
        title: 'Seguretat i canvis',
        body: 'MIGA usa galetes de sessió protegides i controls contra peticions falsificades; les credencials de sessió no es guarden en Web Storage. Esta política pot canviar abans de producció i haurà de revisar-se quan canvien els tractaments.',
      },
    ],
  },
}

function PrivacyPage() {
  const { lang } = useT()
  const copy = privacyCopy[lang]
  const authCopy = authCopyByLanguage[lang]

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to="/" aria-label={authCopy.common.backHome}>
        <img
          src="/brand/04_miga_alt_logo_horizontal_transparent.png"
          alt="Miga"
          className="h-7 w-auto"
        />
      </Link>
      <article className="mt-10 rounded-3xl bg-surface p-6 ring-1 ring-black/5 sm:p-10">
        <p className="text-sm font-semibold text-apricot">{copy.updated}</p>
        <h1 className="mt-2 text-3xl font-extrabold text-charcoal sm:text-4xl">{copy.title}</h1>
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {copy.review}
        </p>
        <p className="mt-5 leading-relaxed text-[color:var(--color-text-muted)]">{copy.intro}</p>
        <div className="mt-8 flex flex-col gap-8">
          {copy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-charcoal">{section.title}</h2>
              <p className="mt-2 leading-relaxed text-[color:var(--color-text-muted)]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}

export default PrivacyPage
