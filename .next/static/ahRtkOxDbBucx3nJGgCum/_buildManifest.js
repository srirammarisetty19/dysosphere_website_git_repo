self.__BUILD_MANIFEST = {
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/",
        "destination": "/index.html"
      },
      {
        "source": "/about",
        "destination": "/about.html"
      },
      {
        "source": "/contact",
        "destination": "/contact.html"
      },
      {
        "source": "/product",
        "destination": "/product.html"
      },
      {
        "source": "/solutions",
        "destination": "/solutions.html"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/_app",
    "/_error"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()