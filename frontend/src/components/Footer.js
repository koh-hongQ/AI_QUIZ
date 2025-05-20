import React from 'react';
import { Box, Text, Flex, Link } from '@chakra-ui/react';

const Footer = () => {
  return (
    <Box as="footer" bg="teal.500" py={4} px={6} color="white">
      <Flex direction="column" align="center" justify="center">
        <Text fontSize="sm">
          AI Quiz Generator &copy; {new Date().getFullYear()}
        </Text>
        <Text fontSize="xs" mt={1}>
          Powered by LLM + RAG Technology
        </Text>
      </Flex>
    </Box>
  );
};

export default Footer;