import type { Language } from '@/i18n/types'

export type AuthCopy = {
  common: {
    email: string
    password: string
    currentPassword: string
    newPassword: string
    confirmPassword: string
    continue: string
    backHome: string
    privacy: string
    genericError: string
    passwordsMismatch: string
    passwordHint: string
  }
  login: {
    title: string
    subtitle: string
    submit: string
    forgot: string
    noAccount: string
    register: string
  }
  register: {
    title: string
    subtitle: string
    submit: string
    hasAccount: string
    login: string
    acceptPrivacy: string
    importDemo: string
    importDemoHint: string
    importDemoSyncError: string
  }
  forgot: {
    title: string
    subtitle: string
    submit: string
    success: string
  }
  reset: {
    title: string
    subtitle: string
    submit: string
    success: string
    invalidLink: string
  }
  verify: {
    title: string
    subtitle: string
    confirm: string
    resend: string
    sent: string
    success: string
    invalidLink: string
  }
  demo: {
    title: string
    subtitle: string
    starting: string
    retry: string
  }
  banner: {
    label: string
    expires: string
    ephemeral: string
    register: string
    reset: string
    resetting: string
  }
  sync: {
    synced: string
    pending: string
    syncing: string
    conflict: string
    error: string
  }
  account: {
    title: string
    signedInAs: string
    logout: string
    logoutUnsynced: string
    logoutLocalFiles: string
    changePassword: string
    passwordChanged: string
    export: string
    exportHint: string
    exportSuccess: string
    reauthHint: string
    deleteTitle: string
    deleteHint: string
    deleteConfirm: string
    deleteAction: string
  }
  pwa: {
    updateAvailable: string
    updateNow: string
    later: string
  }
}

const es: AuthCopy = {
  common: {
    email: 'Correo electrónico',
    password: 'Contraseña',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    confirmPassword: 'Repite la contraseña',
    continue: 'Continuar',
    backHome: 'Volver al inicio',
    privacy: 'Política de privacidad',
    genericError: 'No se pudo completar la operación. Inténtalo de nuevo.',
    passwordsMismatch: 'Las contraseñas no coinciden.',
    passwordHint: 'Usa una contraseña larga y única; puedes pegarla desde tu gestor.',
  },
  login: {
    title: 'Iniciar sesión',
    subtitle: 'Accede a tus datos guardados de MIGA.',
    submit: 'Entrar',
    forgot: 'He olvidado mi contraseña',
    noAccount: '¿Todavía no tienes cuenta?',
    register: 'Crear cuenta',
  },
  register: {
    title: 'Crear cuenta',
    subtitle: 'Guarda tu progreso y accede desde otros dispositivos.',
    submit: 'Crear cuenta',
    hasAccount: '¿Ya tienes cuenta?',
    login: 'Iniciar sesión',
    acceptPrivacy: 'He leído y acepto la política de privacidad.',
    importDemo: 'Copiar los datos de esta demo a mi cuenta',
    importDemoHint:
      'Es opcional y solo se hará tras esta acción explícita. Los PDF, vídeos, audios e imágenes seguirán solo en este dispositivo: no se sincronizan.',
    importDemoSyncError:
      'No hemos podido guardar los cambios de la demo. Comprueba tu conexión antes de crear la cuenta.',
  },
  forgot: {
    title: 'Recuperar acceso',
    subtitle: 'Te enviaremos instrucciones si existe una cuenta asociada.',
    submit: 'Enviar instrucciones',
    success: 'Si existe una cuenta asociada, recibirás un correo con los siguientes pasos.',
  },
  reset: {
    title: 'Nueva contraseña',
    subtitle: 'El enlace solo puede utilizarse una vez y caduca.',
    submit: 'Cambiar contraseña',
    success: 'Contraseña actualizada. Ya puedes iniciar sesión.',
    invalidLink: 'El enlace no contiene los datos necesarios o ya no es válido.',
  },
  verify: {
    title: 'Verificar correo',
    subtitle: 'Confirma tu correo para completar la protección de la cuenta.',
    confirm: 'Verificar correo',
    resend: 'Reenviar verificación',
    sent: 'Si corresponde, se ha enviado un nuevo correo de verificación.',
    success: 'Correo verificado correctamente.',
    invalidLink: 'Abre el enlace completo recibido por correo para verificar la cuenta.',
  },
  demo: {
    title: 'Preparando la demo',
    subtitle: 'Crearemos un espacio aislado con datos totalmente ficticios.',
    starting: 'Iniciando MIGA…',
    retry: 'Reintentar',
  },
  banner: {
    label: 'Demostración',
    expires: 'Caduca {date}',
    ephemeral: 'Los datos son ficticios y pueden restablecerse o desaparecer.',
    register: 'Crear cuenta para guardar',
    reset: 'Restablecer demo',
    resetting: 'Restableciendo…',
  },
  sync: {
    synced: 'Guardado',
    pending: 'Cambios pendientes',
    syncing: 'Guardando…',
    conflict: 'Conflicto de sincronización: tus cambios locales no se han sobrescrito.',
    error: 'Sin conexión: volveremos a intentarlo.',
  },
  account: {
    title: 'Cuenta y seguridad',
    signedInAs: 'Sesión iniciada como {email}',
    logout: 'Cerrar sesión',
    logoutUnsynced:
      'Hay cambios que no se han podido sincronizar. Si cierras sesión ahora, se eliminará la copia local. ¿Quieres continuar?',
    logoutLocalFiles:
      'Este dispositivo guarda {count} archivo(s) local(es) ({size}) que no se sincronizan ni se incluyen en el backup: PDF, vídeo, audio o imágenes. Cerrar sesión los eliminará. ¿Quieres continuar?',
    changePassword: 'Cambiar contraseña',
    passwordChanged: 'Contraseña actualizada.',
    export: 'Exportar mis datos',
    exportHint:
      'Confirma tu contraseña antes de generar la exportación. El JSON no incluye PDF, vídeo, audio ni imágenes.',
    exportSuccess: 'Exportación descargada.',
    reauthHint: 'La confirmación protege las operaciones sensibles.',
    deleteTitle: 'Eliminar cuenta',
    deleteHint: 'La eliminación es irreversible. Escribe DELETE y confirma tu contraseña.',
    deleteConfirm: 'Escribe DELETE',
    deleteAction: 'Eliminar mi cuenta',
  },
  pwa: {
    updateAvailable: 'Hay una versión nueva de MIGA disponible.',
    updateNow: 'Actualizar',
    later: 'Más tarde',
  },
}

const en: AuthCopy = {
  common: {
    email: 'Email',
    password: 'Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Repeat password',
    continue: 'Continue',
    backHome: 'Back to home',
    privacy: 'Privacy policy',
    genericError: 'The operation could not be completed. Please try again.',
    passwordsMismatch: 'Passwords do not match.',
    passwordHint: 'Use a long, unique password; password managers are supported.',
  },
  login: {
    title: 'Sign in',
    subtitle: 'Access your saved MIGA data.',
    submit: 'Sign in',
    forgot: 'I forgot my password',
    noAccount: 'Do not have an account yet?',
    register: 'Create account',
  },
  register: {
    title: 'Create account',
    subtitle: 'Save your progress and access it from other devices.',
    submit: 'Create account',
    hasAccount: 'Already have an account?',
    login: 'Sign in',
    acceptPrivacy: 'I have read and accept the privacy policy.',
    importDemo: 'Copy this demo data into my account',
    importDemoHint:
      'Optional; it only happens after this explicit action. PDFs, video, audio, and images remain on this device only and are not synchronized.',
    importDemoSyncError:
      'We could not save the demo changes. Check your connection before creating the account.',
  },
  forgot: {
    title: 'Recover access',
    subtitle: 'We will send instructions if an account is associated with that email.',
    submit: 'Send instructions',
    success: 'If an account exists, you will receive an email with the next steps.',
  },
  reset: {
    title: 'New password',
    subtitle: 'The link is single-use and expires.',
    submit: 'Change password',
    success: 'Password updated. You can now sign in.',
    invalidLink: 'The link is incomplete or no longer valid.',
  },
  verify: {
    title: 'Verify email',
    subtitle: 'Confirm your email to finish protecting the account.',
    confirm: 'Verify email',
    resend: 'Resend verification',
    sent: 'When applicable, a new verification email has been sent.',
    success: 'Email verified.',
    invalidLink: 'Open the complete link from your email to verify the account.',
  },
  demo: {
    title: 'Preparing the demo',
    subtitle: 'We are creating an isolated workspace with entirely fictional data.',
    starting: 'Starting MIGA…',
    retry: 'Try again',
  },
  banner: {
    label: 'Demo',
    expires: 'Expires {date}',
    ephemeral: 'The data is fictional and may be reset or disappear.',
    register: 'Create account to save',
    reset: 'Reset demo',
    resetting: 'Resetting…',
  },
  sync: {
    synced: 'Saved',
    pending: 'Pending changes',
    syncing: 'Saving…',
    conflict: 'Sync conflict: your local changes were not overwritten.',
    error: 'Offline: we will try again.',
  },
  account: {
    title: 'Account and security',
    signedInAs: 'Signed in as {email}',
    logout: 'Sign out',
    logoutUnsynced:
      'Some changes could not be synchronized. Signing out now will remove the local copy. Continue?',
    logoutLocalFiles:
      'This device stores {count} local file(s) ({size}) that are neither synchronized nor included in the backup: PDFs, video, audio, or images. Signing out will delete them. Continue?',
    changePassword: 'Change password',
    passwordChanged: 'Password updated.',
    export: 'Export my data',
    exportHint:
      'Confirm your password before generating the export. The JSON excludes PDF, video, audio, and images.',
    exportSuccess: 'Export downloaded.',
    reauthHint: 'Confirmation protects sensitive operations.',
    deleteTitle: 'Delete account',
    deleteHint: 'Deletion is irreversible. Type DELETE and confirm your password.',
    deleteConfirm: 'Type DELETE',
    deleteAction: 'Delete my account',
  },
  pwa: {
    updateAvailable: 'A new version of MIGA is available.',
    updateNow: 'Update',
    later: 'Later',
  },
}

const va: AuthCopy = {
  common: {
    email: 'Correu electrònic',
    password: 'Contrasenya',
    currentPassword: 'Contrasenya actual',
    newPassword: 'Nova contrasenya',
    confirmPassword: 'Repeteix la contrasenya',
    continue: 'Continuar',
    backHome: 'Tornar a l’inici',
    privacy: 'Política de privacitat',
    genericError: 'No s’ha pogut completar l’operació. Torna-ho a intentar.',
    passwordsMismatch: 'Les contrasenyes no coincidixen.',
    passwordHint: 'Usa una contrasenya llarga i única; pots usar el teu gestor.',
  },
  login: {
    title: 'Iniciar sessió',
    subtitle: 'Accedix a les teues dades guardades de MIGA.',
    submit: 'Entrar',
    forgot: 'He oblidat la contrasenya',
    noAccount: 'Encara no tens compte?',
    register: 'Crear compte',
  },
  register: {
    title: 'Crear compte',
    subtitle: 'Guarda el progrés i accedix des d’altres dispositius.',
    submit: 'Crear compte',
    hasAccount: 'Ja tens compte?',
    login: 'Iniciar sessió',
    acceptPrivacy: 'He llegit i accepte la política de privacitat.',
    importDemo: 'Copiar les dades d’esta demo al meu compte',
    importDemoHint:
      'És opcional i només es farà després d’esta acció explícita. Els PDF, vídeos, àudios i imatges continuaran només en este dispositiu: no se sincronitzen.',
    importDemoSyncError:
      'No hem pogut guardar els canvis de la demo. Comprova la connexió abans de crear el compte.',
  },
  forgot: {
    title: 'Recuperar accés',
    subtitle: 'Enviarem instruccions si hi ha un compte associat.',
    submit: 'Enviar instruccions',
    success: 'Si existix un compte, rebràs un correu amb els passos següents.',
  },
  reset: {
    title: 'Nova contrasenya',
    subtitle: 'L’enllaç només es pot usar una vegada i caduca.',
    submit: 'Canviar contrasenya',
    success: 'Contrasenya actualitzada. Ja pots iniciar sessió.',
    invalidLink: 'L’enllaç està incomplet o ja no és vàlid.',
  },
  verify: {
    title: 'Verificar correu',
    subtitle: 'Confirma el correu per a completar la protecció del compte.',
    confirm: 'Verificar correu',
    resend: 'Reenviar verificació',
    sent: 'Si correspon, s’ha enviat un correu de verificació nou.',
    success: 'Correu verificat correctament.',
    invalidLink: 'Obri l’enllaç complet rebut per correu.',
  },
  demo: {
    title: 'Preparant la demo',
    subtitle: 'Crearem un espai aïllat amb dades totalment fictícies.',
    starting: 'Iniciant MIGA…',
    retry: 'Tornar-ho a intentar',
  },
  banner: {
    label: 'Demostració',
    expires: 'Caduca {date}',
    ephemeral: 'Les dades són fictícies i poden restablir-se o desaparéixer.',
    register: 'Crear compte per a guardar',
    reset: 'Restablir demo',
    resetting: 'Restablint…',
  },
  sync: {
    synced: 'Guardat',
    pending: 'Canvis pendents',
    syncing: 'Guardant…',
    conflict: 'Conflicte de sincronització: els canvis locals no s’han sobreescrit.',
    error: 'Sense connexió: ho tornarem a intentar.',
  },
  account: {
    title: 'Compte i seguretat',
    signedInAs: 'Sessió iniciada com a {email}',
    logout: 'Tancar sessió',
    logoutUnsynced:
      'Hi ha canvis que no s’han pogut sincronitzar. Si tanques la sessió ara, s’eliminarà la còpia local. Vols continuar?',
    logoutLocalFiles:
      'Este dispositiu guarda {count} fitxer(s) local(s) ({size}) que no se sincronitzen ni s’inclouen en la còpia: PDF, vídeo, àudio o imatges. Tancar la sessió els eliminarà. Vols continuar?',
    changePassword: 'Canviar contrasenya',
    passwordChanged: 'Contrasenya actualitzada.',
    export: 'Exportar les meues dades',
    exportHint:
      'Confirma la contrasenya abans de generar l’exportació. El JSON no inclou PDF, vídeo, àudio ni imatges.',
    exportSuccess: 'Exportació descarregada.',
    reauthHint: 'La confirmació protegix les operacions sensibles.',
    deleteTitle: 'Eliminar compte',
    deleteHint: 'L’eliminació és irreversible. Escriu DELETE i confirma la contrasenya.',
    deleteConfirm: 'Escriu DELETE',
    deleteAction: 'Eliminar el meu compte',
  },
  pwa: {
    updateAvailable: 'Hi ha una versió nova de MIGA disponible.',
    updateNow: 'Actualitzar',
    later: 'Més tard',
  },
}

export const authCopyByLanguage: Record<Language, AuthCopy> = { es, en, va }
