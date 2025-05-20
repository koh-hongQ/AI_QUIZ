import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, 
  Flex, 
  Heading, 
  Button, 
  HStack, 
  useColorMode, 
  IconButton 
} from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';

const Header = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Box as="header" bg="teal.500" py={4} px={6} color="white">
      <Flex justify="space-between" align="center">
        <Heading as="h1" size="lg">
          <RouterLink to="/">AI Quiz Generator</RouterLink>
        </Heading>
        
        <HStack spacing={4}>
          <Button as={RouterLink} to="/" variant="ghost" _hover={{ bg: 'teal.600' }}>
            Home
          </Button>
          <Button as={RouterLink} to="/upload" variant="ghost" _hover={{ bg: 'teal.600' }}>
            Upload PDF
          </Button>
          <Button as={RouterLink} to="/saved-quizzes" variant="ghost" _hover={{ bg: 'teal.600' }}>
            My Quizzes
          </Button>
          <IconButton
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="ghost"
            aria-label={`Toggle ${colorMode === 'light' ? 'Dark' : 'Light'} Mode`}
            _hover={{ bg: 'teal.600' }}
          />
        </HStack>
      </Flex>
    </Box>
  );
};

export default Header;