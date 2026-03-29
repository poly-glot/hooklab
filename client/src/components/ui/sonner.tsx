import { Toaster as Sonner } from "sonner"

import styles from "./sonner.module.css"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className={styles.uiToaster}
      toastOptions={{
        classNames: {
          toast: styles.uiToast,
          description: styles.uiToastDescription,
          actionButton: styles.uiToastActionBtn,
          cancelButton: styles.uiToastCancelBtn,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
