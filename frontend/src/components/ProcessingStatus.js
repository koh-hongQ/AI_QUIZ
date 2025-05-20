import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Progress,
  Flex,
  VStack,
  Circle,
  Icon,
  Divider,
  Button,
  Alert,
  AlertIcon,
  Badge,
  Heading,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import { CheckIcon, TimeIcon, WarningIcon } from '@chakra-ui/icons';
import { FiFileText, FiCpu, FiDatabase, FiZap, FiLayers } from 'react-icons/fi';
import { getProcessingStatus, apiUtils } from '../api';

const ProcessingStage = ({ stage, status, isLast }) => {
  const getStageConfig = () => {
    const configs = {
      uploading: {
        label: 'File Upload',
        description: 'Uploading your PDF file to our server',
        icon: FiFileText,
        color: 'blue'
      },
      extracting: {
        label: 'Text Extraction',
        description: 'Extracting text using PyMuPDF and OCR',
        icon: FiFileText,
        color: 'purple'
      },
      cleaning: {
        label: 'AI Text Cleaning',
        description: 'Cleaning and correcting text with LLM',
        icon: FiCpu,
        color: 'cyan'
      },
      chunking: {
        label: 'Smart Chunking',
        description: 'Creating semantic chunks for better understanding',
        icon: FiLayers,
        color: 'orange'
      },
      embedding: {
        label: 'Vector Embeddings',
        description: 'Generating embeddings with e5-small model',
        icon: FiZap,
        color: 'pink'
      },
      storing: {
        label: 'Vector Database',
        description: 'Storing vectors in Qdrant for fast retrieval',
        icon: FiDatabase,
        color: 'green'
      }
    };
    
    return configs[stage] || {
      label: stage,
      description: '',
      icon: CheckIcon,
      color: 'gray'
    };
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'green.500';
      case 'processing':
        return `${getStageConfig().color}.500`;
      case 'pending':
        return 'gray.300';
      case 'failed':
      case 'error':
        return 'red.500';
      default:
        return 'gray.300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return CheckIcon;
      case 'processing':
        return TimeIcon;
      case 'failed':
      case 'error':
        return WarningIcon;
      default:
        return getStageConfig().icon;
    }
  };

  const config = getStageConfig();

  return (
    <Box mb={isLast ? 0 : 4} width="100%">
      <Flex align="start">
        <Circle
          size="40px"
          bg={getStatusColor()}
          color="white"
          mr={4}
          position="relative"
        >
          <Icon as={getStatusIcon()} boxSize={5} />
          {status === 'processing' && (
            <Box
              position="absolute"
              top="-2px"
              right="-2px"
              width="12px"
              height="12px"
              borderRadius="full"
              bg={`${config.color}.400`}
              animation="ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
            />
          )}
        </Circle>
        <VStack align="start" spacing={1} flex="1">
          <Flex align="center" gap={2}>
            <Text fontWeight="bold" fontSize="md">
              {config.label}
            </Text>
            <Badge
              colorScheme={status === 'completed' ? 'green' : status === 'processing' ? config.color : 'gray'}
              variant="subtle"
              size="sm"
            >
              {status.toUpperCase()}
            </Badge>
          </Flex>
          <Text fontSize="sm" color="gray.600">
            {config.description}
          </Text>
        </VStack>
      </Flex>
      {!isLast && (
        <Box ml="20px" mt={2} mb={2}>
          <Divider
            orientation="vertical"
            height="20px"
            borderColor={status === 'completed' ? 'green.200' : 'gray.200'}
            borderWidth="2px"
          />
        </Box>
      )}
    </Box>
  );
};

const ProcessingStatus = ({ documentId, onProcessingComplete, filename }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPolling, setIsPolling] = useState(true);

  const checkStatus = async (retryAttempt = 0) => {
    try {
      setError(null);
      const response = await getProcessingStatus(documentId);
      setStatus(response);
      setLoading(false);
      setRetryCount(0);

      if (response.status === 'completed') {
        setIsPolling(false);
        if (onProcessingComplete) {
          onProcessingComplete(response);
        }
      } else if (response.status === 'failed' || response.status === 'error') {
        setIsPolling(false);
        setError('Processing failed. Please try uploading again.');
      } else if ((response.status === 'processing' || response.status === 'pending') && isPolling) {
        // Check again in 3 seconds
        setTimeout(() => checkStatus(retryAttempt), 3000);
      }
    } catch (err) {
      console.error('Error checking status:', err);
      const errorMessage = apiUtils.formatErrorMessage(err);
      setError(errorMessage);
      setLoading(false);
      
      // Retry logic with exponential backoff
      if (retryAttempt < 3 && isPolling) {
        const delay = Math.pow(2, retryAttempt) * 2000; // 2s, 4s, 8s
        setRetryCount(retryAttempt + 1);
        setTimeout(() => checkStatus(retryAttempt + 1), delay);
      } else {
        setIsPolling(false);
      }
    }
  };

  useEffect(() => {
    if (documentId) {
      checkStatus();
    }
    
    return () => {
      setIsPolling(false);
    };
  }, [documentId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount(0);
    setIsPolling(true);
    checkStatus();
  };

  if (loading && !status) {
    return (
      <Box textAlign="center" p={6} borderWidth="1px" borderRadius="lg">
        <VStack spacing={4}>
          <Heading size="md" color="blue.500">Initializing Processing</Heading>
          <Text color="gray.600">Checking processing status...</Text>
          <Progress isIndeterminate size="md" colorScheme="blue" w="100%" />
        </VStack>
      </Box>
    );
  }

  if (error && !status) {
    return (
      <Alert status="error" borderRadius="lg">
        <AlertIcon />
        <Box flex="1">
          <Text fontWeight="bold">Processing Status Error</Text>
          <Text fontSize="sm">{error}</Text>
          {retryCount > 0 && (
            <Text fontSize="xs" color="gray.500" mt={1}>
              Retry attempt: {retryCount}/3
            </Text>
          )}
        </Box>
        <Button ml={4} onClick={handleRetry} colorScheme="red" size="sm">
          Retry
        </Button>
      </Alert>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" p={6} bg="white">
      <VStack spacing={4} align="stretch">
        <Flex justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Heading size="md" color="gray.700">
              Processing Status
            </Heading>
            {filename && (
              <Text fontSize="sm" color="gray.500" noOfLines={1}>
                File: {filename}
              </Text>
            )}
          </VStack>
          <Badge
            colorScheme={
              status.status === 'completed' ? 'green' :
              status.status === 'processing' ? 'blue' :
              status.status === 'failed' ? 'red' : 'gray'
            }
            size="lg"
            px={3}
            py={1}
          >
            {status.status.toUpperCase()}
          </Badge>
        </Flex>

        <Box>
          <Flex justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.600">Overall Progress</Text>
            <Text fontSize="sm" color="gray.600" fontWeight="bold">
              {status.progress}%
            </Text>
          </Flex>
          <Progress
            value={status.progress}
            size="lg"
            colorScheme={
              status.status === 'completed' ? 'green' :
              status.status === 'failed' ? 'red' : 'blue'
            }
            hasStripe={status.status === 'processing'}
            isAnimated={status.status === 'processing'}
            borderRadius="md"
          />
        </Box>

        <Box>
          <Heading size="sm" color="gray.600" mb={3}>Processing Stages</Heading>
          <VStack spacing={2} align="stretch">
            {status.stages && status.stages.map((stage, index) => (
              <ProcessingStage
                key={stage.id}
                stage={stage.id}
                status={stage.status}
                isLast={index === status.stages.length - 1}
              />
            ))}
          </VStack>
        </Box>

        {status.status === 'completed' && (
          <Alert status="success" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <Text fontWeight="bold">Processing Complete!</Text>
              <Text fontSize="sm">
                Your document is ready for AI-powered quiz generation.
              </Text>
            </Box>
          </Alert>
        )}

        {status.status === 'failed' && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <Text fontWeight="bold">Processing Failed</Text>
              <Text fontSize="sm">
                There was an error processing your document. Please try uploading again.
              </Text>
            </Box>
            <Button ml={4} onClick={handleRetry} colorScheme="red" size="sm">
              Retry Processing
            </Button>
          </Alert>
        )}

        {status.status === 'processing' && (
          <Box textAlign="center" p={3} bg="blue.50" borderRadius="md">
            <Text fontSize="sm" color="blue.700">
              AI is currently processing your document. This may take a few minutes depending on the document size.
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default ProcessingStatus;