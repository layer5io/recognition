import * as React from "react"
import Seo from "../sitecomponents/SEO"

const NotFoundPage = ({ location }) => {
  return (
    <>
      <h1>404: Not Found</h1>
      <p>Please take a moment to let us know.</p>
    </>
  )
}

export const Head = () => <Seo title="404: Not Found" pathname="/404" />

export default NotFoundPage