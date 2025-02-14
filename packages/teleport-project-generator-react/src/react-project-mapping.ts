import { Mapping } from '@teleporthq/teleport-types'

export const ReactProjectMapping: Mapping = {
  elements: {
    navlink: {
      elementType: 'Link',
      dependency: {
        type: 'library',
        path: 'react-router-dom',
        version: '4.3.1',
        meta: {
          namedImport: true,
        },
      },
      attrs: {
        to: { type: 'dynamic', content: { referenceType: 'attr', id: 'transitionTo' } },
      },
    },
  },
}
