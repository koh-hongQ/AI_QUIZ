import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#e6f7f7',
    100: '#ccefef',
    200: '#99dfdf',
    300: '#66cfcf',
    400: '#33bfbf',
    500: '#00afaf',
    600: '#008c8c',
    700: '#006969',
    800: '#004646',
    900: '#002323',
  },
};

const fonts = {
  heading: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`,
  body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`,
};

const theme = extendTheme({
  config,
  colors,
  fonts,
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'medium',
        borderRadius: 'md',
      },
    },
    Heading: {
      baseStyle: {
        fontWeight: 'semibold',
      },
    },
  },
});

export default theme;